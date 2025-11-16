const express = require('express');
const router = express.Router();
const { timestampIntoString } = require('../utilities/dateTime');
const setCartCookie = require('../middlewares/cartCookie');
const { body, validationResult, query } = require('express-validator');


const limit = 3;

router.get('/', setCartCookie, async (req, res) => {

    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if(!userId) {
        return res.redirect('/auth/login');
    }
    
    let totalCartItem = req.totalCart || 0;;
    let allOrders = [];
    let pendingOrders;
    let totalAllOrders = 0
    let totalPendingOrders = 0;

    //pending and all order detail
    try {
        const ordersCollection = req.firestore2.collection('orderByUserId').doc(userId).collection('orders');

        const pendingCountSnapshot = await ordersCollection
            .where('status', '==', 'pending')
            .count()
            .get();
            
        totalPendingOrders = pendingCountSnapshot.data().count;
        const allCountSnapshot = await ordersCollection.count().get();
        totalAllOrders = allCountSnapshot.data().count;

        const pendingOrdersSnapshot = await ordersCollection
            .where('status', '==', 'pending')
            .orderBy('orderTime', 'desc')
            .limit(limit)
            .get();
            
            pendingOrders = pendingOrdersSnapshot.docs.map(doc => ({
                orderId: doc.id,
                orderTime: timestampIntoString(doc.data().orderTime),
                deliveryTime: timestampIntoString(doc.data().deliveryTime) || 'Within 15 minutes',
                status: doc.data().status,
                totalItems: doc.data().totalItems,
                totalPrice: doc.data().totalPrice
            }));
            
        // Fetch the first page of all orders
        const allOrdersSnapshot = await ordersCollection
            .orderBy('orderTime', 'desc')
            .limit(limit)
            .get();

        allOrders = allOrdersSnapshot.docs.map(doc => ({
            orderId: doc.id,
            orderTime: timestampIntoString(doc.data().orderTime),
            deliveryTime: timestampIntoString(doc.data().deliveryTime) || 'Within 15 minutes',
            status: doc.data().status,
            totalItems: doc.data().totalItems,
            totalPrice: doc.data().totalPrice
        }));

        return res.render('orders', {
            nonce: res.locals.nonce,
            activePage: 'orders',
            user: "true", // Replace with user data
            totalCart: totalCartItem, // Replace with cart count
            pendingOrders,
            allOrders,
            totalPendingOrders,
            totalAllOrders,
            totalPendingPages: Math.ceil(totalPendingOrders / limit),
            totalAllPages: Math.ceil(totalAllOrders / limit),
        });
    } catch (error) {
        console.error('Error loading orders page:', error);
        return res.render('orders', {
            nonce: res.locals.nonce,
            activePage: 'orders',
            user: "true",
            totalCart: totalCartItem,
            pendingOrders,
            allOrders,
            totalPendingOrders,
            totalAllOrders,
            totalPendingPages: 0,
            totalAllPages: 0,
        });
    }
});

// Route to fetch orders by page (AJAX)
router.post('/fetch-orders',
    [body('page').matches(/^[^<>/]*$/).withMessage('Invalid character obtained while loading.'),],
    [body('type').matches(/^[^<>/]*$/).withMessage('Invalid characters obtained while loading.'),], 
    
    async (req, res) => {

    if (!validationResult(req).isEmpty()) return res.json({ message: validationResult(req).array()[0].msg, type: 'negative' });

    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if(!userId) {
        return res.json({ success: "redirect", message: 'Please login to your account to proceed.' });
    } 
    try {
        const { page, type } = req.body;
        const ordersCollection = req.firestore2.collection('orderByUserId').doc(userId).collection('orders');
        const offset = (page - 1) * limit; 

        let query;
        if (type === 'pending') {
            query = ordersCollection
                .where('status', '==', 'pending')
                .orderBy('orderTime', 'desc')
                .offset(offset)
                .limit(limit);
        } else {
            query = ordersCollection.orderBy('orderTime', 'desc').offset(offset).limit(limit);
        }

        const snapshot = await query.get();
        const orders = snapshot.docs.map(doc => ({
            orderId: doc.id,
            orderTime: timestampIntoString(doc.data().orderTime),
            deliveryTime: timestampIntoString(doc.data().deliveryTime) || 'Within 15 minutes',
            status: doc.data().status,
            totalItems: doc.data().totalItems,
            totalPrice: doc.data().totalPrice
        }));

        return res.json({ success: true, orders });
    } catch (error) {
        console.error('Error fetching paginated orders:', error);
        return res.status(500).json({ success: false, message: 'Error fetching orders' });
    }
});


module.exports = router;