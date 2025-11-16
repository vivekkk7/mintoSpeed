const jwt = require('jsonwebtoken');
const expressSession = require('express-session');
const SESSION_SECRET = process.env.SESSION_SECRET;
const JWT_SECRET = process.env.JWT_SECRET;
const maxageTimeForSession = 6 * 30 * 24 * 60 * 60 * 1000; //6 months
const maxageTimeForAuthJWT = 6 * 30 * 24 * 60 * 60; //6 months
const maxageTimeForAdminJWT = 24 * 60 * 60; //24 hours
const maxageTimeForAccessJWT = 12 * 60 * 60; //12 hours
const maxageTimeForAuth = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months
const FirebaseStore = require('../databaseQuery/firebaseSessionStore');


// Middleware to verify JWT and set user in the request
const authenticateJWT = (req, res, next) => {
  const token = req.cookies.auth_token;
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};

// Middleware to generate a new JWT
const generateAuthToken = (userId, phoneNumber) => {
  return jwt.sign({ userId, phoneNumber }, JWT_SECRET, { expiresIn: maxageTimeForAuthJWT });
};

// Middleware to generate a new JWT
const generateAccessToken = (userId, accept_lg, userAgent, ip, isLogIn, timestamp) => {
  return jwt.sign({ userId, accept_lg, userAgent, ip, isLogIn, timestamp }, JWT_SECRET, { expiresIn: maxageTimeForAccessJWT });
};


//access token verification
const accessTokenVerification = async (req, res, next) => {
  const accessToken = req.cookies.access_token;
  if (accessToken) {
    try {
      const decodedAccessToken = jwt.verify(accessToken, JWT_SECRET);
      const { userId, accept_lg, userAgent, ip, isLogIn, timestamp } = decodedAccessToken;
      // console.log('Decoded access Token:', decodedAccessToken);

      // Retrieve current request headers
      const currentUserAgent = req.headers['user-agent'];
      const currentAcceptLanguage = req.headers['accept-language'];
      const currentIpAddress = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;

      // Compare metadata
      const deviations = [];
      if (userAgent !== currentUserAgent) {
        deviations.push('User-Agent mismatch : ' + userAgent + ", " + currentUserAgent);
      }
      if (accept_lg !== currentAcceptLanguage) {
        deviations.push('Accept-Language mismatch: ' + accept_lg + ", " + currentAcceptLanguage);
      }
      if (ip !== currentIpAddress) {
        deviations.push('IP Address mismatch: ' + ip + ", " + currentIpAddress);
      }

      if (deviations.length == 3) {
        console.warn('Metadata deviations detected:', deviations);
        try{
          await destroySessionAndCookies(req, res);
        }
        catch(err){
          console.log("can't destroy session");
        }
        req.isAccessToken = false;
        next();
        return;
      }

      const currentTime = Date.now();
      if (currentTime - timestamp > accessTokenValidTime) {
        await verifyAndAddAccessToken(req, res);
        return;
      }
      else {
        req.userId = userId;
        req.isAccessToken = true;
        req.isLogged = isLogIn;
        next();
        return;
      }
    } catch (error) {
      await verifyAndAddAccessToken(req, res);
      return;
    }
  }
  else {
    await verifyAndAddAccessToken(req, res);
    return;
  }

  async function verifyAndAddAccessToken(req, res) {
    const authToken = req.cookies.auth_token;
    const currentTime = Date.now();

    try {
      if (authToken) {
        const decodedAuthToken = jwt.verify(authToken, JWT_SECRET);

        if (currentTime - decodedAuthToken.loginTime > maxageTimeForAuth) {
          await destroySessionAndCookies(req, res);
          req.isAccessToken = false;
          next();
          return;
        }

        if (!req.session || !req.session.metadata.loginTime) {
          req.isAccessToken = false;
          next();
          return;
        }
        else if (req.session.metadata) {
          const sData = req.session.metadata;
          const userId = sData.userId;
          const accept_lg = sData.accept_lg;
          const userAgent = sData.userAgent;
          const ip = sData.ip;
          const isLogIn = sData.isLogIn;
          const loginTime = sData.loginTime;

          if (currentTime - loginTime > maxageTimeForAuth) {
            await destroySessionAndCookies(req, res);

            req.isAccessToken = false;
            next();
            return;
          }

          if (decodedAuthToken.userId != userId) {
            console.log('auth token userId not matched');
            req.isAccessToken = false;
            next();
            return;
          }

          const accessToken = generateAccessToken(userId, accept_lg, userAgent, ip, isLogIn, Date.now());

          res.cookie('access_token', accessToken, {
            maxAge: maxageTimeForAccessJWT,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
            sameSite: 'Strict'
          });

          req.userId = userId;
          req.isAccessToken = true;
          req.isLogged = isLogIn;
          next();
          return;
        }

      }
      else {
        req.isAccessToken = false;
        next();
        return;
      }
    }
    catch (error) {
      await destroySessionAndCookies(req, res);
      console.error('authToken verification failed:', error.message); // Log errors
      req.isAccessToken = false;
      next();
      return;
    }
  }
};

async function destroySessionAndCookies(req, res) {
  try {
    await new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

  } catch (error) {
    console.error('Error during logout:', error.message);
  }

  //clear cookies
  res.clearCookie('connect.sid');
  res.clearCookie('auth_token');
  res.clearCookie('access_token');
  res.clearCookie('totalCart');
}

module.exports = {
  authenticateJWT,
  generateAuthToken,
  generateAccessToken,
  accessTokenVerification,
  sessionMiddleware: expressSession({
    store: new FirebaseStore(), // Use custom Firebase session store
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: maxageTimeForSession,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
      sameSite: 'Strict'    
    }
  }),
};
