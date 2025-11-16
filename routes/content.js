const express = require('express');
const router = express.Router();
const setCartCookie = require('../middlewares/cartCookie');

// Render the about page
router.get('/about-us', setCartCookie, (req, res) => {
    let totalCartItem = req.totalCart || 0;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';
    return res.render('c/about-us', { nonce: res.locals.nonce, activePage: 'about-us', user: signedUser, totalCart: totalCartItem });
});

// Render the contact page
router.get('/contact', setCartCookie, (req, res) => {
    let totalCartItem = req.totalCart || 0;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';
    return res.render('c/contact', { nonce: res.locals.nonce, activePage: 'contact', user: signedUser, totalCart: totalCartItem });
});

// Render the privacy-policy page
router.get('/privacy-policy', setCartCookie, (req, res) => {
    let totalCartItem = req.totalCart || 0;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';
    return res.render('c/privacy-policy', { nonce: res.locals.nonce, activePage: 'privacy-policy', user: signedUser, totalCart: totalCartItem });
});

// Render the terms-and-condition page
router.get('/terms-and-conditions', setCartCookie, (req, res) => {
    let totalCartItem = req.totalCart || 0;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';
    return res.render('c/terms-and-condition', { nonce: res.locals.nonce, activePage: 'terms-and-condition', user: signedUser, totalCart: totalCartItem });
});

module.exports = router;
