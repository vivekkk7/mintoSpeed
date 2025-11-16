const express = require('express');
const router = express.Router();
const { timestampIntoString } = require('../utilities/dateTime');

const setCartCookie = require('../middlewares/cartCookie');



router.get('/', setCartCookie, async (req, res) => {
    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if (!userId) {
        return res.redirect('/auth/login');
    }

    let totalCartItem = req.totalCart || 0;;
    let userData = {};
    let pendingOrders = [];


    //user detail
    try {
        const userRef = req.firestore.collection('users').doc(userId);
        const userSnapshot = await userRef.get();

        userData = userSnapshot.data();
        console.log("userData " + userData);

    } catch (error) {
        console.error('User not found to database:', error); // Log the error for debugging
        return res.status(404).json({ error: 'No user found' });
    }


    //pending order detail
    try {
            let query = req.firestore2
                .collection('orderByUserId')
                .doc(userId)
                .collection('orders')
                .where('status', '==', 'pending')
                .orderBy("orderTime", "desc")
                .limit(30);


            const querySnapshot = await query.get();
            // Get the last document for the next pagination
            // lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

            querySnapshot.forEach((doc) => {
                pendingOrders.push({
                    orderId: doc.id,
                    orderTime: timestampIntoString(doc.data().orderTime),
                    deliveryTime: timestampIntoString(doc.data().deliveryTime) || 'Within 15 minutes',
                    status: doc.data().status,
                    totalItems: doc.data().totalItems,
                    totalPrice: doc.data().totalPrice
                });
            });
        
        return res.render('profile', { nonce: res.locals.nonce, activePage: 'profile', user: "true", userData: userData, totalCart: totalCartItem, pendingOrders: pendingOrders });
    } catch (error) {
        console.error("Error retrieving orders:", error);
        return res.render('profile', { nonce: res.locals.nonce, activePage: 'profile', user: "true", userData: userData, totalCart: totalCartItem });
    }
});




module.exports = router;