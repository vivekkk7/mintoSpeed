const express = require('express');
const authenticateAdmin = require('../../middlewares/authenticateAdmin');
const { timestampIntoString, getCurrentISTTime } = require('../../utilities/dateTime');
const { getOrdersNum } = require('../../utilities/utility');
const limit = 3;
const path = require('path');
const admin = require('firebase-admin');
const router = express.Router();

// Admin dashboard (protected route)
const fetchOrders = async (req, orderStatus, orderId) => {
    let contentData = [];
    let errorString = '';
    let metaData = {};

    let flagTitle = `total${orderStatus.charAt(0).toUpperCase() + orderStatus.slice(1)}Orders`;

    let query = req.firestore2.collection('order')
    .where('orderStatus', '==', orderStatus)
    .orderBy('deliveryTime', 'desc')
    .limit(limit);


    if(orderStatus == 'lifetime'){
        query = req.firestore2.collection('order')
        .orderBy('dateTime', 'desc')
        .limit(limit);    

        flagTitle = `lifeTimeOrders`;
    }
    else if(orderStatus == 'pending'){
        query = req.firestore2.collection('order')
        .where('orderStatus', '==', orderStatus)
        .orderBy('dateTime', 'desc')
        .limit(limit);    
    }

    if(orderId){
        query = req.firestore2.collection('order').doc(orderId);
        console.log("orderId 2 : " + orderId);
    }

    try {
        const metaRef = req.firestore2.collection('a_meta').doc('ordersData');
        const metaSnapshot = await metaRef.get();

        metaData = await getOrdersNum(req.firestore2, `${orderStatus}_orders`);
        metaData["all"] = metaSnapshot.exists ? metaSnapshot.data()[flagTitle] : 0;
       
        const orderDocs = await query.get();

        if (!orderDocs.empty) {
            if(orderId){
                const orderData = orderDocs.data();
                if(orderStatus == 'lifetime' || orderData.orderStatus == orderStatus){
                    contentData.push({
                        orderId: orderDocs.id,
                        orderTime: timestampIntoString(orderData.dateTime),
                        deliverTime: orderData.deliveryTime ? timestampIntoString(orderData.deliveryTime) : '',
                        ...orderData,
                    });
                }
            }
            else {
                orderDocs.docs.forEach(doc => {
                    const orderData = doc.data();
                    contentData.push({
                        orderId: doc.id,
                        orderTime: timestampIntoString(orderData.dateTime),
                        deliverTime: orderData.deliveryTime ? timestampIntoString(orderData.deliveryTime) : '',
                        ...orderData,
                    });
                });
            }
        } else {
            errorString = `No ${orderStatus} orders found.`;
        }
    } catch (error) {
        console.error(`Error fetching ${orderStatus} orders:`, error);
        errorString = `Error fetching ${orderStatus} orders.`;
    }

    return { contentData, metaData, errorString };
};


// Route for pending Orders
router.get('/pending', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    const orderId = req.query.orderId || null;
    const isValidString = (str) => !/[<>\/]/.test(str);

    if (orderId && !isValidString(orderId)) return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));

    const activePage = 'pending';
    const activePageTitle = 'Pending Orders'
    
    const { contentData, metaData, errorString } = await fetchOrders(req, activePage, orderId);

    return res.render('admin/adminOrders', {
        nonce: res.locals.nonce,
        activePageTitle,
        contentData,
        metaData,
        errorString,
        activePage,
        flag: orderId,
    });
});


// Route for Completed Orders
router.get('/completed', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    const orderId = req.query.orderId || null;
    const isValidString = (str) => !/[<>\/]/.test(str);

    if (orderId && !isValidString(orderId)) return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));

    const activePage = 'completed';
    const activePageTitle = 'Completed Orders'
    
    const { contentData, metaData, errorString } = await fetchOrders(req, activePage, orderId);

    return res.render('admin/adminOrders', {
        nonce: res.locals.nonce,
        activePageTitle,
        contentData,
        metaData,
        errorString,
        activePage,
        flag: orderId,
    });
});


// Route for cancelled Orders
router.get('/cancelled', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    const orderId = req.query.orderId || null;
    const isValidString = (str) => !/[<>\/]/.test(str);

    if (orderId && !isValidString(orderId)) return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));

    const activePage = 'cancelled';
    const activePageTitle = 'Cancelled Orders'
    
    const { contentData, metaData, errorString } = await fetchOrders(req, activePage, orderId);

    return res.render('admin/adminOrders', {
        nonce: res.locals.nonce,
        activePageTitle,
        contentData,
        metaData,
        errorString,
        activePage,
        flag: orderId,
    });
});


// Route for lifetime Orders
router.get('/lifetime', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    const orderId = req.query.orderId || null;
    const isValidString = (str) => !/[<>\/]/.test(str);

    if (orderId && !isValidString(orderId)) return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));

    const activePage = 'lifetime';
    const activePageTitle = 'Lifetime Orders'
    
    const { contentData, metaData, errorString } = await fetchOrders(req, activePage, orderId);

    return res.render('admin/adminOrders', {
        nonce: res.locals.nonce,
        activePageTitle,
        contentData,
        metaData,
        errorString,
        activePage,
        flag: orderId,
    });
});



//perform action
router.post('/performAction', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
      return res.json({ type: "negative", message: "Unauthorized Access." });
    }
  
    let { action, orderId, cancelReason, deliveryDateTime, userId } = req.body;
  
    try{
      let deliveryDateTimeFirestore = getCurrentISTTime();
  
      if (action === 'Cancelled' || action === 'Completed' || action === 'Pending') {
        if (action === 'Cancelled') {
          if (!cancelReason || cancelReason.trim().length < 1) {
            return res.json({ message: "Please write cancel reason.", type: "negative" });
          }
          cancelReason = convertToLowercase(cancelReason);
        }
    
        const batch = req.firestore2.batch();
        const orderRef = req.firestore2.collection('order').doc(orderId);
        const userOrderRef = req.firestore2.collection('orderByUserId').doc(userId).collection('orders').doc(orderId);
        const userMetaDataRef = req.firestore2.collection('orderByUserId').doc(userId);
        const metaRef = req.firestore2.collection('a_meta').doc('ordersData');
        //
        const orderDate = getCurrentISTTime();
        const year = orderDate.getFullYear();
        const month = String(orderDate.getMonth() + 1).padStart(2, "0");
        const day = String(orderDate.getDate()).padStart(2, "0");
        const monthDocId = `${year}-${month}`;
        
    
        // Get the snapshot of meta data
        const metaSnapshot = await metaRef.get();
        let metaData = metaSnapshot.exists ? metaSnapshot.data() : { lifeTimeOrders: 0, totalPendingOrders: 0, totalCancelledOrders: 0, totalCompletedOrders: 0,};
    
        const usermetaSnapshot = await userMetaDataRef.get();
        let usermetaData = usermetaSnapshot.exists ? usermetaSnapshot.data() : { lifeTimeOrders: 0, totalPendingOrders: 0, totalCancelledOrders: 0, totalCompletedOrders: 0,};
    
    
        if (action === 'Cancelled') {
          batch.update(orderRef, { orderStatus: action.toLowerCase(), deliveryTime: deliveryDateTimeFirestore, cancelReason, whoCancelled: "agent" });
          batch.update(userOrderRef, { status: action.toLowerCase(), deliveryTime: deliveryDateTimeFirestore, cancelReason, whoCancelled: "agent" });
          //increment
          const docRef = metaRef.collection("cancelled_orders").doc(monthDocId);
    
            batch.set(
                docRef,
                {
                    this_month: admin.firestore.FieldValue.increment(1),
                    [day]: admin.firestore.FieldValue.increment(1)
                },
                { merge: true }
            );
            
            metaData.totalPendingOrders = metaData.totalPendingOrders && metaData.totalPendingOrders > 0 ? metaData.totalPendingOrders - 1 : 0;
            metaData.totalCancelledOrders = metaData.totalCancelledOrders && metaData.totalCancelledOrders > 0 ? metaData.totalCancelledOrders + 1 : 1;
        
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
        
          batch.update(metaRef, metaData);
          batch.update(userMetaDataRef, usermetaData);
        } else if (action === 'Completed') {
          batch.update(orderRef, { orderStatus: action.toLowerCase(), deliveryTime: deliveryDateTimeFirestore });
          batch.update(userOrderRef, { status: action.toLowerCase(), deliveryTime: deliveryDateTimeFirestore });
          //increment
          const docRef = metaRef.collection("completed_orders").doc(monthDocId);
    
            batch.set(
                docRef,
                {
                    this_month: admin.firestore.FieldValue.increment(1),
                    [day]: admin.firestore.FieldValue.increment(1)
                },
                { merge: true }
            );

          const userdocRef = userMetaDataRef.collection("completed_orders").doc(monthDocId);
    
            batch.set(
                userdocRef,
                {
                    this_month: admin.firestore.FieldValue.increment(1),
                    [day]: admin.firestore.FieldValue.increment(1)
                },
                { merge: true }
            );
    
            metaData.totalPendingOrders = metaData.totalPendingOrders && metaData.totalPendingOrders > 0 ? metaData.totalPendingOrders - 1 : 0;
            metaData.totalCompletedOrders = metaData.totalCompletedOrders && metaData.totalCompletedOrders > 0 ? metaData.totalCompletedOrders + 1 : 1;
        
            usermetaData.totalPendingOrders = usermetaData.totalPendingOrders && usermetaData.totalPendingOrders > 0 ? usermetaData.totalPendingOrders - 1 : 0;
            usermetaData.totalCompletedOrders = usermetaData.totalCompletedOrders && usermetaData.totalCompletedOrders > 0 ? usermetaData.totalCompletedOrders + 1 : 1;
        
          batch.update(metaRef, metaData);
          batch.update(userMetaDataRef, usermetaData);
        } else if (action === 'Pending') {
          if(deliveryDateTime){
            const localDate = new Date(deliveryDateTime); // Local time
            deliveryDateTime = new Date(localDate.getTime() - (5 * 60 + 30) * 60 * 1000);
          }
          deliveryDateTimeFirestore = deliveryDateTime ? deliveryDateTime : getCurrentISTTime();
          batch.update(orderRef, { orderStatus: action.toLowerCase(), deliveryTime: deliveryDateTimeFirestore });
          batch.update(userOrderRef, { status: action.toLowerCase(), deliveryTime: deliveryDateTimeFirestore });
        }
    
        await batch.commit();
    
        return res.json({ message: "Operation performed successfully.", type: "positive" });
      }
    }
    catch(err){
      return res.json({ message: "Error : " + err, type: "negative" });
    }
});
  

function convertToLowercase(input) {
  return input.toLowerCase();
}
  

module.exports = router;