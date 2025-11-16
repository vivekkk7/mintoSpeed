const express = require('express');
const authenticateAdmin = require('../../middlewares/authenticateAdmin');
const path = require('path');
const { timestampIntoString, getCurrentISTTime } = require('../../utilities/dateTime');
const admin = require('firebase-admin');
const router = express.Router();


// 
router.get('/stock', authenticateAdmin, (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    return res.render('admin/adminStock', { nonce: res.locals.nonce });
});

router.post('/update-stock', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.json({ success: false, message: "Unauthorized Access." });
    }
    const regex = /^(?:\d+|(?:\d+\s(kg|gm))|x)$/;

    const isValidNumber = (num) => regex.test(num);
    const isValidString = (str) => !/[<>\/]/.test(str);

    let { itemName, stock, category, subcategory } = req.body;

    if (category == null || subcategory == null || itemName == null || stock == null) {
        return res.json({ success: false, message: 'itemName, Stock, Category or subcategory not found.' });
    }

    console.log("stock : " + itemName + stock + category + subcategory);

    if (!isValidNumber(stock)) return res.json({ success: false, message: 'Invalid or missing stock.' });
    if (!isValidString(category)) return res.json({ success: false, message: 'Invalid < > / characters or missing category.' });
    if (!isValidString(subcategory)) return res.json({ success: false, message: 'Invalid < > / characters or missing subcategory.' });
    if (!isValidString(itemName)) return res.json({ success: false, message: 'Invalid < > / characters or missing itemName.' });

    itemName = convertToLowercase(itemName);
    category = convertToLowercase(category);
    subcategory = convertToLowercase(subcategory);
    try {
        const db = req.firestore;
        const itemsSnapshot = db.collection('items').doc(category).collection(subcategory).doc(itemName);
        const docSnapshot = await itemsSnapshot.get();

        if (docSnapshot.exists) {
            await itemsSnapshot.update({
                stock: stock,
            });

            try {
                const itemsSnapshot2 = db.collection("trendingItems").doc(itemName);
                const docSnapshot2 = await itemsSnapshot2.get();

                if (docSnapshot2.exists) {
                    await itemsSnapshot2.update({
                        stock: stock,
                    });
                }

            } catch (err) {
                return res.json({ success: false, message: 'Stock not updated in trending items.' });
            }
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Error in /delete-item route:", error);
        return res.json({ success: false, message: 'Failed to update stock.' });
    }
});



// trending items
router.get('/addTrendingItem', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }

    const items = [];
    const db = req.firestore;

    try {
        const snapshot = await db.collection("trendingItems").get();

        if (snapshot.empty) {
            console.log("No trending items found.");
            return res.render('admin/adminTrendingItem', { nonce: res.locals.nonce });
        }
        else {
            snapshot.forEach(doc => {
                items.push({ id: doc.id, ...doc.data() });
            });

            return res.render('admin/adminTrendingItem', { nonce: res.locals.nonce, items: items });
        }
    }
    catch (err) {
        return res.render('admin/adminTrendingItem', { nonce: res.locals.nonce });
    }
});

//update
router.post('/update-trending-items', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.json({ success: false, message: "Unauthorized Access." });
    }

    let { itemName, category, subcategory, flag } = req.body;
    console.log("trending data : " + itemName + category + subcategory + flag);

    const isValidString = (str) => str != null && !/[<>\/]/.test(str);

    if (!isValidString(itemName)) return res.json({ success: false, message: 'Invalid or missing itemName.' });
    if (!isValidString(category)) return res.json({ success: false, message: 'Invalid or missing category.' });
    if (!isValidString(subcategory)) return res.json({ success: false, message: 'Invalid or missing subcategory.' });
    if (!isValidString(flag)) return res.json({ success: false, message: 'Invalid or missing flag.' });

    itemName = convertToLowercase(itemName);
    category = convertToLowercase(category);
    subcategory = convertToLowercase(subcategory);
    flag = convertToLowercase(flag);

    try {
        const db = req.firestore;

        const itemsSnapshot = db.collection('trendingItems').doc(itemName);
        const docSnapshot = await itemsSnapshot.get();

        if (flag == "remove") {
            if (docSnapshot.exists) {
                await itemsSnapshot.delete();
            }
        }
        else if (flag == "update") {
            if (!docSnapshot.exists) {
                try {
                    const itemsRef = db.collection('items').doc(category).collection(subcategory).doc(itemName);
                    const itemsSnap = await itemsRef.get();

                    if (itemsSnap.exists) {
                        const itemData = itemsSnap.data();
                        itemData.dateTime = getCurrentISTTime();
                        await itemsSnapshot.set(itemData);
                        return res.json({ success: true, itemData });
                    }
                    else {
                        return res.json({ success: false, message: 'Item not exists.' });
                    }
                } catch (err) {
                    return res.json({ success: false, message: 'Item not added.' });
                }
            }
        }
        else {
            return res.json({ success: false, message: 'Button status not got.' });
        }

        return res.json({ success: true });
    } catch (error) {
        console.error("Error in /delete-item route:", error);
        return res.json({ success: false, message: 'Failed to update stock.' });
    }
});


//fetch orders 
router.post('/fetch-orders', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.json({ success: false, message: "Unauthorized Access." });
    }

    const limit = 2;
    let { page, flag } = req.body;
    const isValidString = (str) => str != null && !/[<>\/]/.test(str);

    if (!isValidString(flag)) return res.json({ success: false, message: 'Invalid or missing flag.' });

    const pendordersRef = req.firestore2.collection(flag);
    const offset = (page - 1) * limit;
    const detailedOrders = [];
    let errorString = '';

    try {
        const snapshot = await pendordersRef.orderBy('dateTime', 'desc').offset(offset).limit(limit).get();

        if (!snapshot.empty) {
            for (const doc of snapshot.docs) {
                const orderId = doc.id;

                try {
                    const orderDoc = await req.firestore2.collection("order").doc(orderId).get();
                    if (orderDoc.exists) {
                        const orderData = orderDoc.data();
                        detailedOrders.push({
                            orderId,
                            orderTime: timestampIntoString(orderData.dateTime),
                            deliverTime: timestampIntoString(orderData.deliveryTime) || '',
                            ...orderData,
                        });
                    } else {
                        console.log(`Order ${orderId} not found in Firestore`);
                        errorString += `Order ${orderId} not found in Firestore`;
                    }
                } catch (firestoreError) {
                    console.error(`Error fetching Firestore details for order ${orderId}:`, firestoreError);
                    errorString += `Error fetching Firestore details for order ${orderId}:`;
                }
            }
        } else {
            console.log("No pending orders found.");
            return res.json({ success: false, message: `No pending orders found.` });
        }

        return res.json({ success: true, detailedOrders, message: 'Order fetch successfully!', errorString });
    } catch (error) {
        console.error('Error fetching paginated orders:', error);
        return res.json({ success: false, message: `Error fetching orders + ${error}` });
    }
});



/////
const getStartDate = (index) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Reset time to 00:00:00
    let startDate = null;
    let endDate = null;

    switch (index) {
        case 1: // Today
            startDate = now;
            break;
        case 2: //Yesterday
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 1);
            endDate = new Date(now); // Today 00:00:00 acts as the upper bound
            break;
        case 3: // Last 7 days
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            break;
        case 4: // This month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        case 5: // Last month
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 1); // Start of this month
            break;
        default:
            return { startDate: null, endDate: null }; // No filter
    }
    return { startDate, endDate };
};

//order
router.post('/load_data', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.json({ success: false, message: "Unauthorized Access." });
    }

    const limit = 2;
    const orders = [];
    let errorString = '';
    let flagTime = 'deliveryTime';

    let { lastVisible, index, activePage } = req.body;
    const isValidString = (str) => str != null && !/[<>\/]/.test(str);
    
    if (!isValidString(activePage)) {
        return res.json({ success: false, message: 'Invalid or missing active page name.' });
    }

    let query = req.firestore2.collection('order').where('orderStatus', '==', activePage).orderBy(flagTime, 'desc').limit(limit);

    if (activePage == 'lifetime') {
        query = req.firestore2.collection('order').orderBy('dateTime', 'desc').limit(limit);
        flagTime = 'dateTime';
    }

    if (activePage == 'pending') {
        query = req.firestore2.collection('order').where('orderStatus', '==', activePage).orderBy('dateTime', 'desc').limit(limit);
        flagTime = 'dateTime';
    }

    try {
        const { startDate, endDate } = getStartDate(index);

        if (startDate) {
            query = query.where(flagTime, '>=', startDate);
        }
        if (endDate) {
            query = query.where(flagTime, '<', endDate);
        }

        if (lastVisible) {
            const lastVisibleDoc = await req.firestore2.collection('order').doc(lastVisible).get();
            if (lastVisibleDoc.exists) {
                query = query.startAfter(lastVisibleDoc);
            } else {
                return res.json({ success: false, message: 'Invalid lastVisible document.' });
            }
        }

        const orderDocs = await query.get();

        if (!orderDocs.empty) {
            orderDocs.forEach(doc => {
                const orderData = doc.data();
                orders.push({
                    orderId: doc.id,
                    orderTime: timestampIntoString(orderData.dateTime),
                    deliverTime: orderData.deliveryTime ? timestampIntoString(orderData.deliveryTime) : '',
                    ...orderData,
                });

            });
            return res.json({ success: true, orders, error: errorString });
        } else {
            console.log("No orders found");

            errorString = 'No orders found.';
            return res.json({ success: false, message: 'Invalid lastVisible document.' });
        }
    } catch (firestoreError) {
        console.error('Error fetching Firestore details:', firestoreError);
        errorString = 'Error fetching Firestore details.';
        return res.json({ success: false, message: 'Invalid lastVisible document.' });
    }

});


//complaint and feedback
router.post('/load_cf_data', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.json({ success: false, message: "Unauthorized Access." });
    }

    const limit = 2;
    const orders = [];
    let errorString = '';

    let { lastVisible, index, activePage } = req.body;
    const isValidString = (str) => str != null && !/[<>\/]/.test(str);

    if (!isValidString(activePage)) {
        return res.json({ success: false, message: 'Invalid or missing active page name.' });
    }

    const flagTime = activePage == "users" ? 'signupOn' : 'dateTime';
    const reqs = activePage == "users" ? req.firestore : req.firestore2;
    let query = reqs.collection(activePage).orderBy(flagTime, 'desc').limit(limit);

    try {
        const { startDate, endDate } = getStartDate(index);

        if (startDate) {
            query = query.where(flagTime, '>=', startDate);
        }
        if (endDate) {
            query = query.where(flagTime, '<', endDate);
        }

        if (lastVisible) {
            const lastVisibleDoc = await reqs.collection(activePage).doc(lastVisible).get();
            if (lastVisibleDoc.exists) {
                query = query.startAfter(lastVisibleDoc);
            } else {
                return res.json({ success: false, message: 'Invalid lastVisible document.' });
            }
        }

        const orderDocs = await query.get();

        if (!orderDocs.empty) {
            orderDocs.forEach(doc => {
                const orderData = doc.data();
                orders.push({
                    id: doc.id,
                    time: timestampIntoString(orderData.dateTime),
                    signupon: timestampIntoString(orderData.signupOn),
                    createdon: timestampIntoString(orderData.createdOn),
                    ...orderData,
                });

            });
            return res.json({ success: true, orders, error: errorString });
        } else {
            console.log("No data found");

            errorString = 'No data found.';
            return res.json({ success: false, message: 'Invalid lastVisible document.' });
        }
    } catch (firestoreError) {
        console.error('Error fetching Firestore details:', firestoreError);
        errorString = 'Error fetching Firestore details.';
        return res.json({ success: false, message: 'Invalid lastVisible document.' });
    }
});


//load user metadata
router.post('/load_user_metadata', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.json({ success: false, message: "Unauthorized Access." });
    }

    let { userId } = req.body;
    let metadata = {};
    const isValidString = (str) => str != null && !/[<>\/]/.test(str);

    if (!isValidString(userId)) return res.json({ success: false, message: 'Invalid or missing userId.' });

    try {
        const db = req.firestore2;

        const metaSnapshot = db.collection('orderByUserId').doc(userId);
        const docSnapshot = await metaSnapshot.get();

        metadata = docSnapshot.data();
        return res.json({ success: true, metadata });
    } catch (error) {
        console.error("Error in load_user_metadata", error);
        return res.json({ success: false, message: 'Failed to get data.' });
    }
});


// add lat lng of delivery boy
router.post('/addlatlngofDeliveryBoy', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(401).json({ success: "negative", message: 'Unauthorized access.' });
    }

    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if (!userId || userId !== process.env.ADMIN_USER_ID ) {
        return res.status(400).json({ success: "negative", message: 'This is not delivery boy.' });
    }

    let { latitude, longitude } = req.body;

    // Convert to numbers
    latitude = parseFloat(latitude);
    longitude = parseFloat(longitude);

    if (!latitude || !longitude) {
        return res.status(400).json({ success: "negative", message: 'Latitude and longitude not found.' });
    }

    function isValidLatitude(lat) {
        return typeof lat === "number" && !isNaN(lat) && lat >= -90 && lat <= 90;
    }

    function isValidLongitude(lon) {
        return typeof lon === "number" && !isNaN(lon) && lon >= -180 && lon <= 180;
    }

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
        return res.status(400).json({ success: "negative", message: 'Invalid latitude and longitude values.' });
    }

    try {
        if (!req.firestore2) {
            return res.status(500).json({ success: "negative", message: 'Firestore not initialized.' });
        }

        const dataRef = req.firestore2.collection("latlng").doc("deliveryboy");

        await dataRef.set({ latitude, longitude }, { merge: true });

        return res.status(200).json({ success: "positive", message: 'Location updated successfully.' });

    } catch (error) {
        console.error('Error storing location:', error);
        return res.status(500).json({ success: "negative", message: 'Error storing data. Please try again.' });
    }
});



function convertToLowercase(input) {
    return input.toLowerCase();
}

module.exports = router;