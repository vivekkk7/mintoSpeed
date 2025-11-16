const express = require('express');
const router = express.Router();
const { timestampIntoString } = require('../utilities/dateTime');

const setCartCookie = require('../middlewares/cartCookie');


router.get('/', setCartCookie, async (req, res) => {
    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if(!userId) {
        return res.redirect('/auth/login');
    }
    let totalCartItem = req.totalCart || 0;;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';

    return res.render('track', { nonce: res.locals.nonce, activePage: 'track', user: signedUser, totalCart: totalCartItem });
});


//return order data by orderid
router.post('/submit', async (req, res) => {
    let orderId  = req.body.orderId;
    const regex = /^[a-zA-Z0-9]+$/;     //allow only alphabets and numbers
    let tr;

    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if(!userId){
        return res.json({ message: 'Please sign in to track your order.', type: 'negative' });
    }

    if (!orderId) {
        return res.json({ message: 'Please enter your order ID.', type: 'negative' });
    }
     else if (!regex.test(orderId)) {
        return res.json({ message: 'Invalid order ID! Only alphabets and numbers are allowed..', type: 'negative' });
    }
     else if (orderId.length != 10) {
        return res.json({ message: 'Invalid order ID! Order Id should be of 10 characters.', type: 'negative' });
    }



    try {
        const userRef = req.firestore2.collection("order").doc(orderId);
    
        const doc = await userRef.get();

        if(!doc.exists){
            return res.json({ message: `Order not found for order ID - ${orderId}`, type: 'negative' });
        }
            tr = {
                orderId: doc.id,
                orderTime: timestampIntoString(doc.data().dateTime),
                deliveryTime: timestampIntoString(doc.data().deliveryTime) || 'Within 15 minutes',
                orderTotalItems: doc.data().orderTotalItems,
                orderTotalPrice: doc.data().orderTotalPrice,
                orderStatus: doc.data().orderStatus
            }
          
    
    
    } catch (error) {
        console.error('Order not found in the database:', error); // Log the error for debugging
        return res.json({ message: 'Something went wrong. Please try again..', type: 'negative' });
    }

    return res.json({ message: 'Order found.', type: 'positive', orderData: tr });

});



module.exports = router;