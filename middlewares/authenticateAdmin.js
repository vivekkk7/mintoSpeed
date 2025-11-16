const jwt = require('jsonwebtoken');
const jwtSecret  = process.env.JWT_SECRET_ADMIN;


module.exports = (req, res, next) => {
    const token = req.cookies.alpha_token;
    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if (!token || !userId || (userId !== process.env.DEVELOPER_USER_ID && userId !== process.env.ADMIN_USER_ID && userId !== process.env.ADMIN_USER_ID2)) {
        req.isAlphaToken = false;
        next();
        return;
    }

    try {
        const decoded = jwt.verify(token, jwtSecret); // Verify the token
        console.log('Decoded Token:', decoded); // Log the decoded payload

        if (decoded.role !== 'admin') {
            req.isAlphaToken = false;
            next();
            return;        
        }

        req.admin = decoded; // Attach token info to request
        console.log('Middleware passed, calling next()');
        req.isAlphaToken = true;
        next();
        return;
    } catch (error) {
        console.error('Token verification failed:', error.message); // Log errors
        req.isAlphaToken = false;
        next();
        return;    
    }
};

