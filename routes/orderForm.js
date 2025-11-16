const express = require('express');
const router = express.Router();
const ejs = require("ejs");
const admin = require('firebase-admin');

const orderFormSubmitUser = require('../controllers/orderFormSubmitUser');
const orderFormSubmitAgent = require('../controllers/orderFormSubmitAgent');
const { body, validationResult, query } = require('express-validator');

const coupanValidTill = 12; //12 months
const { getCurrentISTTime, timestampIntoString, dateTimeForRealTimeDatabase } = require('../utilities/dateTime');

const { generateUniqueId, getClosestWeightAndPrice } = require('../utilities/utility');


// Serve the main page (index.ejs)
router.get('/', [
    query('tempOrderId')
        .custom(value => {
            if (/[<>\/]/.test(value)) {
                throw new Error('Invalid characters detected (<, >, /)');
            }
            return true;
        })
], async (req, res) => {

    if (!validationResult(req).isEmpty()) return res.status(404).sendFile(path.join(__dirname, '../', 'public', '404.html'));

    const orderId = req.query.tempOrderId;
    let userData = {};

    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';
    let userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if (!userId) {
        return res.redirect('/auth/login');
    }

    let validateInput = (input) => typeof input === 'string' && /^[a-zA-Z0-9_\- &,.]+$/.test(input);
    if (!validateInput(orderId)) {
        return res.render('orderForm', { nonce: res.locals.nonce, activePage: 'orderForm', user: signedUser });
    }

    try {
        // Define the path to the specific order in the database
        const orderRef = req.database.ref(`tempOrder/${orderId}`);
        const snapshot = await orderRef.get();

        if (snapshot.exists) {
            const tempOrderData = snapshot.val();
            console.log('Order Data:', tempOrderData);

            // Reference to the user in Firestore
            const userRef = req.firestore.collection('users').doc(userId);
            let userSnapshot;
            try {
                userSnapshot = await userRef.get();
            } catch (error) {
                console.error('Error userSnapshot:', error);
            }
            userData = userSnapshot.data();


            return res.render('orderForm', { nonce: res.locals.nonce, activePage: 'orderForm', user: signedUser, totalItems: tempOrderData.totalItems, totalPrice: tempOrderData.totalPrice, orderId: orderId, userData });
        } else {
            console.log('No data available for the specified order ID.');
            return res.render('orderForm', { nonce: res.locals.nonce, activePage: 'orderForm', user: signedUser, flag: 'false' });
        }
    } catch (error) {
        console.error('Error fetching order details:', error);
        return res.render('orderForm', { nonce: res.locals.nonce, activePage: 'orderForm', user: signedUser });
    }
});

const validationDataArray = [
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

//store order data into database
router.post('/order', validationDataArray, async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.json({ message: validationResult(req).array()[0].msg, type: 'negative' });

    let errorForAdmin = [];
    let logsForAdmin = [];
    let coupanHtml = '';
    let { fullName, email, phone, streetAddress, city, pincode, orderId, paymentMode, latitude, longitude } = req.body;

    const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

    if (!userId) {
        return res.json({ type: "redirect", message: 'Please login to your account to proceed.' });
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

    try {   
        const phoneRegex = /^(\+91)?[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
            return res.json({ type: 'negative', message: 'Invalid phone number.' });
        }

        fullName = convertToLowercase(fullName);
        streetAddress = convertToLowercase(streetAddress);
        city = convertToLowercase(city);

        // let userFormData = { fullName, email, phone, streetAddress, city, pincode, dateTime: getCurrentISTTime() };
        
        // Reference to the user in Firestore
        const userRef = req.firestore.collection('users').doc(userId);
        const userSnapshot = await userRef.get();

        if (!userSnapshot.exists) {
            return res.redirect('/auth/login');
        }

        const tempOrderRef = req.database.ref(`tempOrder/${orderId}`);
        let orderSnapshot;
        try {
            orderSnapshot = await tempOrderRef.get();
        } catch (error) {
            console.error('tempOrder not found in database:', error);
            errorForAdmin.push("TempOrder not found.");
            return res.json({ message: 'Order not found in database. Please try again.', type: 'negative' });
        }


        //get order item data
        const orderVal = orderSnapshot.val();

        let orderItems = [];
        let totalItems = 0;
        let totalPrice = 0;

        for (let cartId of orderVal.items) {
            const cartItemRef = req.firestore2.collection('cart')
                .doc(userId)
                .collection('cartItems')
                .doc(cartId);

            const doc = await cartItemRef.get();

            if (doc.exists) {
                const cartData = doc.data();
                console.log(" item data :", cartData);
                const { category, subCategory, name, volume } = cartData;
                console.log(` cart item: ${name}, Volume: ${volume}`);

                const itemRef = req.firestore.collection('items').doc(category).collection(subCategory).doc(name);
                const itemSnapshot = await itemRef.get();

                if (!itemSnapshot.exists) {
                    console.log("Order Item data not found.");
                    return res.json({ type: 'negative', message: 'Order Item data not found.' });
                }

                const itemData = itemSnapshot.data();

                let price = getClosestWeightAndPrice(volume, itemData);
                totalPrice += price;
                totalItems += 1;
                console.log("totalPrice " + totalPrice);

                orderItems.push({ cartId: cartId, name: name, quantity: volume, price: price, img: itemData.img });

            } else {
                console.warn(`Cart item with ID ${cartId} does not exist.`);
                errorForAdmin.push(`Cart item with ID ${cartId} does not exist.`);
                return res.json({ type: 'negative', message: `Cart item with ID ${cartId} does not exist.` });
            }
        }

        // //delivery charge added
        // totalPrice = totalPrice < 100 ? totalPrice + 20 : totalPrice;

        const currentDateTime = getCurrentISTTime();
        const timeforEmail = dateTimeForRealTimeDatabase(currentDateTime);

        const orderData = { orderStatus: "pending", orderItems, orderUserId: userId, orderTotalItems: totalItems, orderTotalPrice: totalPrice, cartDateTime: orderVal.dateTime, fullName, email, phone, streetAddress, city, pincode, dateTime: currentDateTime };

        //lattitude and longitude
        if(latitude && longitude && isValidCoordinates(latitude, longitude)){
            orderData.latitude = latitude;
            orderData.longitude = longitude;
        }

        //add order data in firestore order
        const batch = req.firestore2.batch();

        const orderedRef = req.firestore2.collection('order').doc(orderId);
        batch.set(orderedRef, orderData);

        // Add orderByUserId data
        const orderByUserIdrRef = req.firestore2.collection('orderByUserId').doc(userId).collection('orders').doc(orderId);
        const orderInfo = {
            totalPrice: totalPrice,
            totalItems: totalItems,
            status: "pending",
            orderTime: currentDateTime,
        };

        batch.set(orderByUserIdrRef, orderInfo);

        //add totalorder
        const metaRef = req.firestore2.collection('a_meta').doc('ordersData');
        const userMetaDataRef = req.firestore2.collection('orderByUserId').doc(userId);

        const orderDate = new Date(currentDateTime);
        const year = orderDate.getFullYear();
        const month = String(orderDate.getMonth() + 1).padStart(2, "0");
        const day = String(orderDate.getDate()).padStart(2, "0");
        const monthDocId = `${year}-${month}`;

        try {
            const metaSnapshot = await metaRef.get();

            let metaData = metaSnapshot.exists ? metaSnapshot.data() : { lifeTimeOrders: 0, totalPendingOrders: 0 };
            metaData.lifeTimeOrders = metaData.lifeTimeOrders && metaData.lifeTimeOrders > 0 ? metaData.lifeTimeOrders + 1 : 1;
            metaData.totalPendingOrders = metaData.totalPendingOrders && metaData.totalPendingOrders > 0 ? metaData.totalPendingOrders + 1 : 1;

            const docRef = metaRef.collection("lifetime_orders").doc(monthDocId);

            batch.set(
                docRef,
                {
                    this_month: admin.firestore.FieldValue.increment(1),
                    [day]: admin.firestore.FieldValue.increment(1)
                },
                { merge: true }
            );

            batch.set(metaRef, metaData, { merge: true });

            //orderbyuserid
            const usermetaSnapshot = await userMetaDataRef.get();

            let usermetaData = usermetaSnapshot.exists ? usermetaSnapshot.data() : { lifeTimeOrders: 0, totalPendingOrders: 0 };
            usermetaData.lifeTimeOrders = usermetaData.lifeTimeOrders && usermetaData.lifeTimeOrders > 0 ? usermetaData.lifeTimeOrders + 1 : 1;
            usermetaData.totalPendingOrders = usermetaData.totalPendingOrders && usermetaData.totalPendingOrders > 0 ? usermetaData.totalPendingOrders + 1 : 1;

            const userdocRef = userMetaDataRef.collection("lifetime_orders").doc(monthDocId);

            batch.set(
                userdocRef,
                {
                    this_month: admin.firestore.FieldValue.increment(1),
                    [day]: admin.firestore.FieldValue.increment(1)
                },
                { merge: true }
            );
            batch.set(userMetaDataRef, usermetaData, { merge: true });

            await batch.commit();
        } catch (error) {
            console.error('Error committing batch operations:', error); // Log the error for debugging
            return res.json({ message: 'Something went wrong to proceed order. Please try again.', type: 'negative' });
        }


        // //coupan code logic
        // if (totalPrice > 399) {
        //     let coupanId = generateUniqueId(8);
        //     coupanId = coupanId.toUpperCase();
        //     coupanId = coupanId.replace(/(.{4})/g, "$1 ");  // Add a space after every 4 characters
        //     coupanId = coupanId.trim();
        //     const coupanTemplate = 'atylm1';
        //     const couponCode = 'ATYLM ' + coupanId;
        //     const expireTime = getMonthsFromNow(coupanValidTill) + " 23:59:59";

        //     const discount = totalPrice > 1999 ? '20%' : '10%';

        //     const coupanInfo = {
        //         validUptoMonth: coupanValidTill,
        //         coupanCode: couponCode,
        //         coupanTemplate: coupanTemplate,
        //         expireTime: expireTime,
        //         userId: userId,
        //         dateTime: currentDateTime,
        //         discount: discount
        //     };
        //     const data = { coupanCode: couponCode, expireTime: expireTime, discount };

        //     const coupanRef = req.firestore.collection('coupans').doc(couponCode);
        //     try {
        //         await coupanRef.set(coupanInfo);
        //         ejs.renderFile(`views/coupanTemplate/${coupanTemplate}.ejs`, data, (err, html) => {
        //             if (err) {
        //                 errorForAdmin.push("coupan generated but not sent to customer.");
        //                 console.error("Error rendering EJS:", err);
        //             } else {
        //                 coupanHtml = html;
        //             }
        //         });
        //     } catch (error) {
        //         errorForAdmin.push("coupan not added in firestore.");
        //         console.error('Error to add orderByUserId to firestore orderByUserId :', error); // Log the error for debugging
        //     }
        // }


        //delete tempOrder in firebase 
        try {
            await tempOrderRef.remove();
        } catch (error) {
            errorForAdmin.push("Cannot delete tempOrder data");
            console.error("Error deleting tempOrder data:", error);
        }

        //delete order items from cart
        const batch2 = req.firestore2.batch();

        for (let cartId of orderVal.items) {
            const cartItemRef = req.firestore2.collection('cart')
                .doc(userId)
                .collection('cartItems')
                .doc(cartId);

            batch2.delete(cartItemRef);
        }

        try {
            await batch2.commit();
        } catch (error) {
            errorForAdmin.push("Cannot delete cart data in batch");
            console.error('Error deleting cart items in batch:', error); // Log the error for debugging
        }


        //remove total cart cookie
        res.cookie('totalCart', 0, {
            maxAge: 1,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
            sameSite: 'Strict',
        });





        // Construct the notification payload
        // try {
        //     // Retrieve all tokens from Firestore
        //     const tokensSnapshot = await req.firestore.collection("deliveryTokens").get();
        //     if (tokensSnapshot.empty) {
        //         return res.status(404).send({ message: "No tokens available to send notifications" });
        //     }

        //     const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
        //     console.log("tokens : " + tokens);

        //     // Prepare individual messages for each token
        //     const messages = tokens.map(token => ({
        //         notification: {
        //             title: "Someone placed an Order",
        //             body: `Name: ${fullName}, orderId: ${orderId}, View - https://www.mintospeed.in/dashboard/pendingOrders?orderId=${orderId}`,
        //         },
        //         token: token,
        //     }));

        //     // Send notifications using sendEachForMulticast (or batch with send)
        //     const responses = await Promise.all(
        //         messages.map(message => admin.messaging().send(message))
        //     );

        //     // Count successes and failures
        //     const successCount = responses.filter(response => response).length;
        //     const failureCount = responses.length - successCount;

        //     // Log and respond
        //     return res.status(200).send({
        //         message: "Notifications sent successfully",
        //         successCount,
        //         failureCount,
        //     });
        // } catch (error) {
        //     console.error("Error sending notifications:", error);
        //     return res.status(500).send({ error: "Failed to send notifications" });
        // }






        //send order submit email to user
        orderFormSubmitUser.orderFormSubmit(orderItems, orderData, orderId, timeforEmail)
            .then(() => {
                console.log("Order email sent to user.");
            })
            .catch((error) => {
                console.error("Email error :" + error);
                errorForAdmin.push("Order email not sent to user.");
            });

        //send order submit email to agent
        orderFormSubmitAgent.orderFormSubmit(orderItems, orderData, orderId, errorForAdmin, logsForAdmin, timeforEmail)
            .then(() => {
                console.log("Order email sent to agent.");
            })
            .catch((error) => {
                console.error("Email error :" + error);
            });


        // send response to frontend
        return res.json({ type: "positive", message: 'Order successfully placed!', coupanHtml, orderId });

    } catch (error) {
        console.error('Error processing order:', error);
        return res.json({ type: 'negative', message: 'Error placing order. Please try again.' });
    }
});

function convertToLowercase(input) {
    return input.toLowerCase();
}

function getMonthsFromNow(monthNumber) {
    const now = getCurrentISTTime();
    now.setMonth(now.getMonth() + monthNumber);  // Add 6 months to the current date

    // Format the date in a human-readable format (e.g., "December 26, 2024")
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return now.toLocaleDateString('en-US', options); // US format, you can change the locale if needed
}

module.exports = router;