const express = require('express');
const router = express.Router();
const setCartCookie = require('../middlewares/cartCookie');


router.get('/', setCartCookie, async (req, res) => {
    let totalCartItem = req.totalCart || 0;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';

    return res.render('search', { nonce: res.locals.nonce, activePage: 'search', user: signedUser, totalCart: totalCartItem });
});

module.exports = router;
