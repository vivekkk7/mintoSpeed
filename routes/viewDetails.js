const express = require('express');
const { timestampIntoString, differenceInTimeBoolean, getCurrentISTTime, dateTimeForRealTimeDatabase } = require('../utilities/dateTime');
const orderCancelledByUsertoAgent = require('../controllers/orderCancelByUsertoAgent');
const cancelTimeLimit = 10 * 60 * 1000;
const router = express.Router();
const admin = require('firebase-admin');


// Admin dashboard (protected route)
router.get('/', async (req, res) => {
    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;
    let latitude = null;
    let longitude = null;
    if (!userId) {
        return res.redirect('/auth/login');
    }

    const detailedOrders = [];
    const orderId = req.query.orderId;

    let validateInput = (input) => typeof input === 'string' && /^[a-zA-Z0-9]+$/.test(input);
    if (!validateInput(orderId)) {
        return res.render('viewDetails', {
            nonce: res.locals.nonce,
            activePage: 'detail order',
        });
    }

    try {
        const orderDoc = await req.firestore2.collection("order").doc(orderId).get();
        if (orderDoc.exists) {
            const orderData = orderDoc.data();
            const { isUnderMinutes, inputTime } = differenceInTimeBoolean(orderData.dateTime, cancelTimeLimit, getCurrentISTTime());

            latitude = orderData.latitude || null;
            longitude = orderData.longitude || null;

            detailedOrders.push({
                orderId,
                orderTime: timestampIntoString(orderData.dateTime),
                deliverTime: timestampIntoString(orderData.deliveryTime) || 'Within 15 minutes',
                inputTime: inputTime, //for hide cancel button
                isUnderMinutes,
                ...orderData,
            });

        } else {
            console.log(`Order ${orderId} not found in Firestore, `);
            return res.render('viewDetails', {
                nonce: res.locals.nonce,
                activePage: 'detail order',
            });
        }
    } catch (firestoreError) {
        console.error(`Error fetching Firestore details for order ${orderId}:`, firestoreError);
        return res.render('viewDetails', {
            nonce: res.locals.nonce,
            activePage: 'detail order',
        });
    }

    return res.render('viewDetails', {
        nonce: res.locals.nonce,
        activePage: 'detail order',
        orders: detailedOrders, latitude, longitude, orderId
    });

});

//cancel order
router.post('/cancel-order', async (req, res) => {
    let orderId = req.body.orderId;

    let errorForAdmin = [];
    const regex = /^[a-zA-Z0-9]+$/;
    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if (!userId) {
        return res.json({ message: 'Please sign in to cancel your order.', type: 'negative' });
    }

    if (orderId && orderId === "") {
        return res.json({ message: 'No order ID found.', type: 'negative' });
    }
    else if (!regex.test(orderId)) {
        return res.json({ message: 'Invalid order ID! Only alphabets and numbers are allowed..', type: 'negative' });
    }
    else if (orderId.length != 10) {
        return res.json({ message: 'Invalid order ID! Order Id should be of 10 characters.', type: 'negative' });
    }

    const cancelTime = getCurrentISTTime();
    const timeforEmail = dateTimeForRealTimeDatabase(cancelTime);

    try {
        const batch = req.firestore2.batch();
        const orderDate = getCurrentISTTime();
        const year = orderDate.getFullYear();
        const month = String(orderDate.getMonth() + 1).padStart(2, "0");
        const day = String(orderDate.getDate()).padStart(2, "0");
        const monthDocId = `${year}-${month}`;

        //order
        const orderRef = req.firestore2.collection('order').doc(orderId);
        const docSnapshot = await orderRef.get();

        if (docSnapshot.exists) {
            const { isUnderMinutes } = differenceInTimeBoolean(docSnapshot.data().dateTime, cancelTimeLimit, getCurrentISTTime());

            if (!isUnderMinutes) {
                return res.json({ message: 'Order can be cancelled within 10 minutes when you order. You cross the time limit.', type: 'negative' });
            }
            if (docSnapshot.data().orderStatus == "cancelled") {
                return res.json({ message: 'Order already cancelled.', type: 'negative' });
            }
            if (docSnapshot.data().orderStatus == "completed") {
                return res.json({ message: 'Order already complete. Cannot perform action', type: 'negative' });
            }
            batch.update(orderRef, {
                orderStatus: "cancelled",
                deliveryTime: cancelTime,
                cancelReason: '',
                whoCancelled: "user"
            });
        }

        //orderByUserId
        const userOrderRef = req.firestore2.collection('orderByUserId').doc(userId).collection('orders').doc(orderId);
        const userDocSnapshot = await userOrderRef.get();

        if (userDocSnapshot.exists) {
            batch.update(userOrderRef, {
                status: "cancelled",
                deliveryTime: cancelTime,
                cancelReason: '',
                whoCancelled: "user"
            });
        } else {
            errorForAdmin.push("Order not cancelled in orderByUserId.");
        }

        //update totalordersno
        const metaRef = req.firestore2.collection('a_meta').doc('ordersData');
        const metaSnapshot = await metaRef.get();

        let metaData = metaSnapshot.exists ? metaSnapshot.data() : { totalPendingOrders: 0, totalCancelledOrders: 0 };
        metaData.totalCancelledOrders = metaData.totalCancelledOrders && metaData.totalCancelledOrders > 0 ? metaData.totalCancelledOrders + 1 : 1;
        metaData.totalPendingOrders = metaData.totalPendingOrders && metaData.totalPendingOrders > 0 ? metaData.totalPendingOrders - 1 : 0;

        const docRef = metaRef.collection("cancelled_orders").doc(monthDocId);

        batch.set(
            docRef,
            {
                this_month: admin.firestore.FieldValue.increment(1),
                [day]: admin.firestore.FieldValue.increment(1)
            },
            { merge: true }
        );

        batch.update(metaRef, metaData);


        //byuserid
        const userMetaDataRef = req.firestore2.collection('orderByUserId').doc(userId);

        const usermetaSnapshot = await userMetaDataRef.get();
        let usermetaData = usermetaSnapshot.exists ? usermetaSnapshot.data() : { lifeTimeOrders: 0, totalPendingOrders: 0, totalCancelledOrders: 0, totalCompletedOrders: 0, totalCancelledOrdersByHim: 0, };
        const userdocRef = userMetaDataRef.collection("cancelled_orders").doc(monthDocId);

        batch.set(
            userdocRef,
            {
                this_month: admin.firestore.FieldValue.increment(1),
                [day]: admin.firestore.FieldValue.increment(1)
            },
            { merge: true }
        );

        usermetaData.totalPendingOrders = usermetaData.totalPendingOrders && usermetaData.totalPendingOrders > 0 ? usermetaData.totalPendingOrders - 1 : 0;
        usermetaData.totalCancelledOrders = usermetaData.totalCancelledOrders && usermetaData.totalCancelledOrders > 0 ? usermetaData.totalCancelledOrders + 1 : 1;
        usermetaData.totalCancelledOrdersByHim = usermetaData.totalCancelledOrdersByHim && usermetaData.totalCancelledOrdersByHim > 0 ? usermetaData.totalCancelledOrdersByHim + 1 : 1;

        batch.update(userMetaDataRef, usermetaData);

        await batch.commit();

        //send email to agent
        orderCancelledByUsertoAgent.orderCancelledByUsertoAgent(timeforEmail, userId, orderId, errorForAdmin)
            .then(() => {
                console.log("Order cancel email sent to agent.");
            })
            .catch((error) => {
                console.error("Email send error :" + error);
            });

    } catch (error) {
        console.error('Something went wrong', error); // Log the error for debugging
        return res.json({ message: 'Something went wrong. Please try again..', type: 'negative' });
    }

    return res.json({ message: 'Order cancelled.', type: 'positive' });
});



module.exports = router;