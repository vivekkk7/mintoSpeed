const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const { getCurrentISTTime } = require('../utilities/dateTime');

const { generateUniqueId, getClosestWeightAndPrice } = require('../utilities/utility');
let monthsAgo = getCurrentISTTime();
monthsAgo.setMonth(monthsAgo.getMonth() - 6); // Go back 6 months

router.get('/', async (req, res) => {
    const userId = (req.isAccessToken && req.userId) ? req.userId : null;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';
    let totalCartItem = 0;;

    // If no user ID or temp ID, return empty cart
    if (!userId) {
        totalCartItem = 0;
        return res.render('cart', { nonce: res.locals.nonce, activePage: 'cart', user: signedUser, totalCart: totalCartItem, cartDetails: [], message: "No cart found." });
    }

    let cartItemsData = [];

    req.firestore2.collection("cart")
        .doc(userId)
        .collection("cartItems")
        .where("dateTime", ">=", monthsAgo)
        .orderBy("dateTime", "desc")
        .get()
        .then((querySnapshot) => {
            if (querySnapshot.empty) {
                console.log("No cart items found.");
            } else {
                querySnapshot.forEach((doc) => {
                    const itemData = doc.data();
                    itemData.cartItemId = doc.id; // Attach the cart item key as cartItemId
                    cartItemsData.push(itemData);
                    console.log("Retrieved item data:", itemData);
                });
            }
        })
        .catch((error) => {
            console.error("Error retrieving documents: ", error);
        })
        .then(async () => {
            if (cartItemsData.length === 0) {
                return res.render('cart', {
                    nonce: res.locals.nonce,
                    activePage: 'cart',
                    user: signedUser,
                    totalCart: 0,
                    cartDetails: [],
                    message: "No cart found."
                });
            }

            const cartDetailsPromises = await getCartDetails(cartItemsData, req);

            const cartDetails = (await Promise.all(cartDetailsPromises)).filter(item => item !== null);
            const totalCartItem = cartDetails.length;

            return res.render('cart', {
                nonce: res.locals.nonce,
                activePage: 'cart',
                user: signedUser,
                totalCart: totalCartItem,
                cartDetails: cartDetails,
                message: ''
            });
        })
        .catch((error) => {
            console.error("Error processing cart items:", error);
            return res.render('cart', {
                nonce: res.locals.nonce,
                activePage: 'cart',
                user: signedUser,
                totalCart: 0,
                cartDetails: [],
                message: "No cart found."
            });
        });
});


//proceed and update cart
router.post('/proceed-cart-items', async (req, res) => {
    const idRegex = /^[a-zA-Z0-9]+$/;
    const weightRegex = /^(\d+(\.\d+)?)(\s?(kg|gm))?$/;
    try {
        const { items, selectedCartItemIds } = req.body; // Capture selectedCartItemIds from request body

        const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;

        if (!userId) {
            return res.json({ success: "redirect", message: 'Please login to your account to proceed.' });
        }

        const firestore = req.firestore2;
        let updatedItemIds = [];
        let totalPrice = 0;
        let totalItems = 0;
        console.log("proceed-cart-items");

        // update item in cart
        if (items && items.length != 0) {

            for (const item of items) {
                const { id, weight } = item;
                console.log("items update : " + id + weight);

                if (!id || !idRegex.test(id)) {
                    console.log("Invalid ID:", id);
                    continue;
                }

                const cartItemRef = firestore.collection('cart')
                    .doc(userId)
                    .collection('cartItems')
                    .doc(id);

                const updateData = {};
                if (weight !== undefined && weightRegex.test(weight)) {
                    updateData.volume = weight;
                }


                try {
                    await cartItemRef.update(updateData);
                    updatedItemIds.push(id); // Track successful update
                } catch (updateError) {
                    console.error(`Error updating item ID ${id}:`, updateError);
                    return res.json({ success: "negative", message: `Something went wrong to update your changes. Please try again.` });
                }
            }
        }

        if (!selectedCartItemIds || selectedCartItemIds.length === 0) {
            return res.json({ success: "negative", message: 'No selected item found.' });
        }
        else {
            for (let cartId of selectedCartItemIds) {
                if (!cartId || !idRegex.test(cartId)) {
                    console.log("Invalid cartId:", cartId);
                    return res.json({ success: "negative", message: 'Invalid cart ID.' });
                }

                const cartItemRef = firestore.collection('cart')
                    .doc(userId)
                    .collection('cartItems')
                    .doc(cartId);

                const doc = await cartItemRef.get();
                console.log("proceed-cart-items selectedCartItemIds");


                if (doc.exists) {
                    const cartData = doc.data();
                    console.log("proceed item data :", cartData);
                    const { category, subCategory, name, volume } = cartData;
                    console.log(`Processing cart item: ${name}, Volume: ${volume}`);

                    // Reference to the item in Firestore
                    const itemRef = req.firestore.collection('items').doc(category).collection(subCategory).doc(name);
                    const itemSnapshot = await itemRef.get();

                    if (!itemSnapshot.exists) {
                        return res.json({ success: "negative", message: 'Item not found. Please try again.' });
                    }

                    const itemData = itemSnapshot.data();

                    totalPrice += getClosestWeightAndPrice(volume, itemData);
                    totalItems += 1;
                    console.log("totalPrice " + totalPrice);

                } else {
                    console.warn(`Cart item with ID ${cartId} does not exist.`);
                }
            }

            //delivery charge added
            // totalPrice = totalPrice < 100 ? totalPrice + 20 : totalPrice;

            //
            const orderData = {
                items: selectedCartItemIds,
                totalPrice: totalPrice,
                totalItems: totalItems,
                userId: userId,
                dateTime: getCurrentISTTime().toLocaleString()
            };

            try {
                const orderId = generateUniqueId(10);

                const orderRef = req.database.ref(`tempOrder/${orderId}`);
                await orderRef.set(orderData);

                return res.json({
                    success: "positive", redirectUrl: `/orderForm?tempOrderId=${orderId}`
                });

            } catch (error) {
                console.error('Error storing order:', error);
                return res.json({ success: "negative", message: 'Error to store order data. Please try again.' });
            }
        }

    } catch (error) {
        console.error('Unexpected error in update-cart-items:', error);
        return res.json({
            success: "negative",
            message: 'An unexpected error occurred while proceeding cart items. Please try again.'
        });
    }
});






// Define a function to retrieve and process cart details
async function getCartDetails(cartItemsData, req) {
    return await Promise.all(cartItemsData.map(async (cartItem) => {
        let { category, subCategory, name, volume } = cartItem;
        name = convertToLowercase(name);
        category = convertToLowercase(category);
        subCategory = convertToLowercase(subCategory);
        console.log(`getCartDetails : ${name}, Volume: ${volume}`);

        // Reference to the item in Firestore
        const itemRef = req.firestore.collection('items').doc(category).collection(subCategory).doc(name);
        const itemSnapshot = await itemRef.get();

        // If item data does not exist, return null to skip it
        if (!itemSnapshot.exists) {
            return res.json({ success: "negative", message: 'Item not found. Please try again.' });
        }

        const itemData = itemSnapshot.data();

        // Assuming getClosestWeightAndPrice is a defined function
        const totalPrice = getClosestWeightAndPrice(volume, itemData);

        // Return the structured item data
        return {
            date: cartItem.date,
            cartItemId: cartItem.cartItemId,
            name: name,
            volume: volume,
            imageUrl: itemData.img,
            price: totalPrice,
            category: category,
            subCategory: subCategory,
            packed: itemData.packed,
            minVolume: itemData.min,
            maxVolume: itemData.max,
            options: JSON.parse(itemData.options) || []
        };
    }));
}

router.post('/delete-cart-item', async (req, res) => {
    const { cartItemId } = req.body;
    const idRegex = /^[a-zA-Z0-9]+$/;
    const userId = (req.isAccessToken && req.userId) ? req.userId : null;

    if(!idRegex.test(cartItemId)){
        return res.json({ success: false, message: 'Invalid cart Id.' });
    }
    if(!userId){
        return res.json({ success: false, message: 'User not found.' });
    }

    // Perform the delete operation
    try {
        const itemsSnapshot = req.firestore2.collection('cart')
        .doc(userId)
        .collection('cartItems')
        .doc(cartItemId);
        
        const docSnapshot = await itemsSnapshot.get();

        if (docSnapshot.exists) {
          await itemsSnapshot.delete();

        res.cookie('totalCart', 0, {
            maxAge: 1,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
            sameSite: 'Strict',
        });
        }
        return res.json({ success: true });
    } catch (error) {
        console.error("Error in /delete-item route:", error);
        return res.json({ success: false, message: 'Failed to delete item.' });
    }
   
});


function convertToLowercase(input) {
    return input.toLowerCase();
}




module.exports = router;