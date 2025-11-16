const express = require('express');
const jwt = require('jsonwebtoken');
const jwtSecret  = process.env.JWT_SECRET_ADMIN;
const verifyRecaptcha = require('../../middlewares/verifyRecaptcha');
const path = require('path');

const router = express.Router();

const activeTime = 7 * 24 * 60 * 60; //7 days

router.get('/', async (req, res) => {
    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;
    if(userId && (userId == process.env.ADMIN_USER_ID || userId == process.env.ADMIN_USER_ID2 || userId == process.env.DEVELOPER_USER_ID) ){
        return res.render('admin/adminLogin', { nonce: res.locals.nonce, activePage: 'admin Login' });
    }
    else{
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
});


// Admin login route
router.post('/login', verifyRecaptcha, (req, res) => {
    if(!req.reCaptcha){
        return res.json({ message: 'Recaptcha verification failed. Please try again.', type: 'negative' });
    }
    const captchaScore = req.captchaScore;
    console.log("captchaScore admin: " + captchaScore);

    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;
    if(!userId || (userId !== process.env.DEVELOPER_USER_ID && userId !== process.env.ADMIN_USER_ID && userId !== process.env.ADMIN_USER_ID2) ){
        return res.json({ type: 'negative', message: 'Unauthorized Access..' });
    }

    const adminCredentials = {
        username: process.env.ADMIN_ID,
        password: process.env.ADMIN_PASSWORD,
    };

    const { username, password } = req.body;

    if (username === adminCredentials.username && password === adminCredentials.password) {
        const token = jwt.sign({ username, role: 'admin' }, jwtSecret, { expiresIn: activeTime });

        res.cookie('alpha_token', token, {
            maxAge: activeTime * 1000, 
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  
            sameSite: 'Strict'
        });
        return res.json({ type: 'positive', message: 'Login successful.' });
    }
    return res.json({ type: 'negative', message: 'Invalid input' });
});


module.exports = router;


