const express = require('express');
const bcrypt = require('bcryptjs');
const admin = require("firebase-admin");
const verifyRecaptcha = require('../middlewares/verifyRecaptcha');
const { getCurrentISTTime } = require('../utilities/dateTime');

const { generateAuthToken, generateAccessToken } = require('../middlewares/authenticateMiddleWares');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const maxageTimeForAuth = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months
const accessTokenValidTime = 12 * 60 * 60 * 1000; //12 hours

const validationSignUpArray = [
    body('fullName')
        .trim()
        .isLength({ min: 3, max: 50 }).withMessage('Full name must be between 3 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Full name must contain only letters and spaces')
        .escape(),

    body('email')
        .trim()
        .isEmail().withMessage('Invalid email address')
        .normalizeEmail()
        .escape(),

    body('streetAddress')
        .trim()
        .isLength({ min: 5, max: 500 }).withMessage('Street address must be between 5 and 500 characters')
        .escape(),

    body('city')
        .trim()
        .isLength({ min: 2, max: 100 }).withMessage('City must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('City must contain only letters and spaces')
        .escape(),

    body('pincode')
        .trim()
        .isPostalCode('IN').withMessage('Invalid postal code format')
        .escape(),
];


// Render the signup page
router.get('/', (req, res) => {
    res.render('signup', { nonce: res.locals.nonce });
});

router.get('/login', (req, res) => {
    res.render('login', { nonce: res.locals.nonce });
});

//add user into database
router.post('/signup', validationSignUpArray, async (req, res) => {
    const tempId = (req.isAccessToken && req.userId && !req.isLogged) ? req.userId : null;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('First Validation Error Message:', errors.array()[0].msg);
        return res.json({ type: 'negative', message: errors.array()[0].msg });
    }

    let { user, fullName, email, streetAddress, city, pincode, password, latitude, longitude } = req.body;

    const userId = user.uid;
    if (!userId || !user.phoneNumber) {
        return res.json({ type: 'negative', message: 'Something went wrong. Refresh page and try again.' });
    }

    function isValidLatitude(lat) {
        return typeof lat === "number" && lat >= -90 && lat <= 90;
    }
    
    function isValidLongitude(lon) {
        return typeof lon === "number" && lon >= -180 && lon <= 180;
    }
    
    function isValidCoordinates(lat, lon) {
        return isValidLatitude(lat) && isValidLongitude(lon);
    }
 

    const phone = user.phoneNumber;
    console.log("signup begain : " + user + fullName + email + phone + streetAddress + city + pincode + password + latitude + longitude);

    const hashedPassword1 = await hashPassword(password);
    const batch2 = req.firestore.batch();

    const dateTime = getCurrentISTTime();
    const credentialData = { userId: userId, password: hashedPassword1, dateTime: dateTime };
    const credentialRef = req.firestore.collection('credential').doc(userId);
    try {
        batch2.set(credentialRef, credentialData);

        let userFormData = { fullName: convertToLowercase(fullName), email, phone, streetAddress: convertToLowercase(streetAddress), city: convertToLowercase(city), pincode, signupOn: dateTime };

         //lattitude and longitude
         if(latitude && longitude && isValidCoordinates(latitude, longitude)){
            userFormData.latitude = latitude;
            userFormData.longitude = longitude;
        }
        
        const userRef = req.firestore.collection('users').doc(userId);
        try {
            const userDoc = await userRef.get();
            if (userDoc.exists) {
                batch2.update(userRef, userFormData);
            } else {
                userFormData.createdOn = dateTime;
                batch2.set(userRef, userFormData);
            }       

            await batch2.commit();
            const loginTime = Date.now();

            //adding sessions and cookies
            const authToken = generateAuthToken(userId, phone, loginTime);

            res.cookie('auth_token', authToken, {
                maxAge: maxageTimeForAuth,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
                sameSite: 'Strict'
            });

            //store session data
            const accept_lg = req.headers['accept-language'];
            const userAgent = req.headers['user-agent'];
            const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
            console.log('Client IP:', ip);
            console.log('currentUserAgent:', userAgent);
            console.log('Accept-Language:', accept_lg);

            const isLogIn = true;

            req.session.metadata = {
                userId: userId,
                accept_lg,
                userAgent,
                ip,
                isLogIn: isLogIn,
                loginTime,
            };

            //access token
            const accessToken = generateAccessToken(userId, accept_lg, userAgent, ip, isLogIn, loginTime);

            res.cookie('access_token', accessToken, {
                maxAge: accessTokenValidTime,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
                sameSite: 'Strict'
            });

            console.log("cookies and session metadata added: " + req.session.metadata);


            //add cart item form tempId to userId if exits
            if (tempId && tempId.length == 64) {
                const oldCartRef = req.firestore2.collection('cart').doc(tempId).collection('cartItems');
                const newCartRef = req.firestore2.collection('cart').doc(userId).collection('cartItems');

                try {
                    // Fetch old cart items
                    const oldCartSnapshot = await oldCartRef.get();

                    if (!oldCartSnapshot.empty) {
                        const batch = req.firestore2.batch();

                        // Add items to the new collection
                        oldCartSnapshot.forEach((doc) => {
                            const data = doc.data(); // Get document data
                            const newDocRef = newCartRef.doc(); // Create a new document reference for the userId cart
                            batch.set(newDocRef, data); // Add data to the batch
                        });

                        // Commit the batch write to Firestore
                        await batch.commit();

                        // Create a new batch to delete old cart items
                        const deleteBatch = req.firestore2.batch();
                        oldCartSnapshot.forEach((doc) => {
                            deleteBatch.delete(doc.ref);
                        });

                        // Commit the delete batch
                        await deleteBatch.commit();
                    } else {
                        console.log("auth: No items found in the tempId cart.");
                    }
                } catch (error) {
                    console.error("auth: Error transferring cart items:", error);
                }
            }

            // return res.redirect('/profile');
            return res.json({ message: 'Account created.', type: 'positive' });
        } catch (error) {
            console.error('User not added to database:', error);
            return res.json({ message: 'Something went wrong to create account. Please try again.', type: 'negative' });
        }
    } catch (error) {
        console.error('User not added to database:', error);
        return res.json({ message: 'Something went wrong to create account. Please try again.', type: 'negative' });
    }

});

router.post('/logout', async (req, res) => {
    try {
        await new Promise((resolve, reject) => {
            req.session.destroy((err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });

        // Clear cookies
        res.clearCookie('connect.sid');
        res.clearCookie('auth_token');
        res.clearCookie('access_token');
        res.clearCookie('totalCart');
        return res.json({ message: '', type: 'positive' });

    } catch (error) {
        //clear cookies
        res.clearCookie('connect.sid');
        res.clearCookie('auth_token');
        res.clearCookie('access_token');
        res.clearCookie('totalCart');
        console.error('Error during logout:', error.message);
        return res.json({ message: '', type: 'positive' });
    }
});


//login
router.post('/login', verifyRecaptcha, async (req, res) => {

    if (!req.reCaptcha) {
        return res.json({ message: 'Recaptcha verification failed. Please try again.', type: 'negative' });
    }

    let { phone, password } = req.body;
    const tempId = (req.isAccessToken && req.userId && !req.isLogged) ? req.userId : null;

    const captchaScore = req.captchaScore;
    console.log("captchaScore : " + captchaScore);
    // const hashedPassword1 = await hashPassword(hashedPassword);

    const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        return res.json({ message: 'Invalid phone number.', type: 'negative' });
    }

    if (!phone.startsWith('+91')) {
        phone = '+91' + phone;
    }
    if (password.length < 6) {
        return res.json({ message: 'Password not matched.', type: 'negative' });
    }

    try {
        const userRecord = await admin.auth().getUserByPhoneNumber(phone);

        console.log("User found:", userRecord.toJSON());
        const phoneNumber = userRecord.phoneNumber;
        if (phoneNumber) {
            console.log("Phone number is verified:", phoneNumber);
            const userId = userRecord.uid;
            console.log("userid : " + userId);

            const userRef = req.firestore.collection('credential').doc(userId);
            try {
                const userData = await userRef.get();
                if (userData.exists) {
                    const dbPassword = userData.data().password;
                    const isPasswordValid = await verifyPassword(password, dbPassword);
                    if (isPasswordValid) {

                        const loginTime = Date.now();

                        //adding sessions and cookies
                        const authToken = generateAuthToken(userId, phoneNumber, loginTime);

                        res.cookie('auth_token', authToken, {
                            maxAge: maxageTimeForAuth,
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
                            sameSite: 'Strict'
                        });

                        //store session data
                        const accept_lg = req.headers['accept-language'];
                        const userAgent = req.headers['user-agent'];
                        const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
                        console.log('Client IP:', ip);
                        console.log('currentUserAgent:', userAgent);
                        console.log('Accept-Language:', accept_lg);

                        const isLogIn = true;
                        req.session.metadata = {
                            userId: userId,
                            accept_lg,
                            userAgent,
                            ip,
                            isLogIn: isLogIn,
                            loginTime,
                        };

                        //access token
                        const accessToken = generateAccessToken(userId, accept_lg, userAgent, ip, isLogIn, loginTime);

                        res.cookie('access_token', accessToken, {
                            maxAge: accessTokenValidTime,
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
                            sameSite: 'Strict'
                        });

                        console.log("cookies and session metadata added: " + req.session.metadata);


                        //add cart item form tempId to userId if exits
                        if (tempId) {
                            const oldCartRef = req.firestore2.collection('cart').doc(tempId).collection('cartItems');
                            const newCartRef = req.firestore2.collection('cart').doc(userId).collection('cartItems');

                            try {
                                // Fetch old cart items
                                const oldCartSnapshot = await oldCartRef.get();

                                if (!oldCartSnapshot.empty) {
                                    const batch = req.firestore2.batch();

                                    // Add items to the new collection
                                    oldCartSnapshot.forEach((doc) => {
                                        const data = doc.data(); // Get document data
                                        const newDocRef = newCartRef.doc(); // Create a new document reference for the userId cart
                                        batch.set(newDocRef, data); // Add data to the batch
                                    });

                                    // Commit the batch write to Firestore
                                    await batch.commit();

                                    // Create a new batch to delete old cart items
                                    const deleteBatch = req.firestore2.batch();
                                    oldCartSnapshot.forEach((doc) => {
                                        deleteBatch.delete(doc.ref);
                                    });

                                    // Commit the delete batch
                                    await deleteBatch.commit();
                                } else {
                                    console.log("auth: No items found in the tempId cart.");
                                }
                            } catch (error) {
                                console.error("auth: Error transferring cart items:", error);
                            }
                        }

                        return res.json({ message: 'Login successfull.', type: 'positive' });
                    }
                    else {
                        return res.json({ message: 'Password not matched.', type: 'negative' });
                    }
                }
                else {
                    return res.json({ message: 'User data not found. Create account with same phone number if issue persist.', type: 'negative' });
                }
            }
            catch (err) {
                return res.json({ message: 'Phone number or password not match. Try again.', type: 'negative' });
            }
        } else {
            return res.json({ message: 'Phone number and password not matched.', type: 'negative' });
        }

    } catch (err) {
        return res.json({ message: 'Phone number or password not match. Please try again.', type: 'negative' });
    }
});


// Function to hash the password
async function hashPassword(plainPassword) {
    const saltRounds = 7; // Adjust for desired security and performance
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    return hashedPassword;
}
// Function to verify password
async function verifyPassword(plainPassword, hashedPassword) {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
}
function convertToLowercase(input) {
    return input.toLowerCase();
}

module.exports = router;

