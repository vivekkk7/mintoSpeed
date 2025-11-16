const express = require('express');
const router = express.Router();
const { body, validationResult, query } = require('express-validator');
const path = require('path');
const { getCurrentISTTime } = require('../utilities/dateTime');

const { generateUniqueId, fetchManyItems } = require('../utilities/utility');

const setCartCookie = require('../middlewares/cartCookie');

// Route to render initial grocery page with EJS
router.get('/', [
    query('c')
        .custom(value => {
            if (/[<>\/]/.test(value)) {
                throw new Error('Invalid characters detected (<, >, /)');
            }
            return true;
        }),
    query('s')
        .custom(value => {
            if (/[<>\/]/.test(value)) {
                throw new Error('Invalid characters detected (<, >, /)');
            }
            return true;
        }),
    query('i')
        .custom(value => {
            if (/[<>\/]/.test(value)) {
                throw new Error('Invalid characters detected (<, >, /)');
            }
            return true;
        })
], setCartCookie, async (req, res) => {

    if (!validationResult(req).isEmpty()) return res.status(404).sendFile(path.join(__dirname, '../', 'public', '404.html'));

    const firestore = req.firestore;
    let userId = (req.isAccessToken && req.userId) ? req.userId : null;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';

    let queryCategory = req.query.c;
    const querySubCategory = req.query.s;
    const queryItem = req.query.i;
    let totalCartItem = req.totalCart || 0;
    let similarItems = [];
    let documentIds = [];
    let item = {};


    if (!queryCategory || !querySubCategory || !queryItem) {
        return res.status(404).sendFile(path.join(__dirname, '../', 'public', '404.html'));
    }

    console.log("query i : " + queryItem);
    const itemName = capitalize(queryItem);

    if (!userId) {
        totalCartItem = 0
    }

    //get category names
    try {
        const categoriesSnapshot = await firestore.collection('items').select().get();

        if (categoriesSnapshot.empty) {
            console.error("No categories data found in Firestore.");
        } else {
            documentIds = categoriesSnapshot.docs.map((doc) => {
                const realName = doc.id; // Assuming the document ID is the real name
                const encodedValue = encodeURIComponent(realName); // URI-encode the real name
                return { key: realName, value: encodedValue }; // Return an object with key and value
            });

            console.log(documentIds);
        }
    } catch (error) {
        console.error("Error in get-categories :", error);
    }


    //fetch item data
    try {
        let query = firestore.collection('items').doc(queryCategory).collection(querySubCategory).doc(queryItem);
        const doc = await query.get();

        item = {
            id: doc.id,
            volume: doc.data().qty,
            price: doc.data().price,
            stock: doc.data().stock || 'x',
            minVol: doc.data().min,
            maxVol: doc.data().max,
            packed: doc.data().packed,
            image_url: doc.data().img,
            popularMRP: doc.data().popularMRP && doc.data().popularMRP.trim() !== '' ? '₹ ' + doc.data().popularMRP : '',
            replaceSelect: doc.data().replaceSelect || 'false',
            itemAbout: doc.data().itemAbout && doc.data().itemAbout != 'null' ? doc.data().itemAbout : '',
            options: JSON.parse(doc.data().options) || []
        };
        console.log("item : " + item);
    }
    catch (error) {
        console.error("Error in item :", error);
        return res.status(404).sendFile(path.join(__dirname, '../', 'public', '404.html'))
    }

    // Fetch similar items
    try {
        let query = firestore.collection('items').doc(queryCategory).collection(querySubCategory);
        const items = await fetchManyItems(query, 0, null);

        similarItems.push({
            cat: queryCategory,
            subcat: querySubCategory,
            items
        });

        return res.render('item', {
            nonce: res.locals.nonce, activePage: 'item',
            user: signedUser, totalCart: totalCartItem,
            similarItems: similarItems,
            item: item,
            category: queryCategory,
            subcategory: querySubCategory,
            itemName: itemName,
            categoryNames: documentIds
        })
    } catch (error) {
        console.error('Error fetching item:', error);
        return res.status(404).sendFile(path.join(__dirname, '../', 'public', '404.html'))
    }
});



//feedback
router.post('/feedback', async (req, res) => {
    let { category,subcategory, itemId, email, rating, feedback } = req.body;
    let userId = (req.isAccessToken && req.userId) ? req.userId : null;
    let feedbackData = {};

    let validateNumberInput = (input, length) => {
        const strInput = String(input); // Convert input to string
        return /^\d+$/.test(strInput) && strInput.length === length;
    };
    
    
    if (!email == null) {
        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.json({ message: `Email is not valid.`, type: 'negative' });
        }
        email = email.toLowerCase();
    }
    if (/[<>]/.test(feedback) || feedback.length < 1) {
        return res.json({ message: 'Blank or Input contains invalid characters like < or >.', type: 'negative' });
    }
    if (/[<>]/.test(itemId) || itemId.length < 1) {
        return res.json({ message: 'Something went wrong with product Id. Try again.', type: 'negative' });
    }
    if (category == null || /[<>]/.test(category) || category.length < 1) {
        return res.json({ message: 'Something went wrong with product Id. Try again.', type: 'negative' });
    }
    if (subcategory == null || /[<>]/.test(subcategory) || subcategory.length < 1) {
        return res.json({ message: 'Something went wrong with product Id. Try again.', type: 'negative' });
    }
    if (!validateNumberInput(rating, 1)) return res.json({ message: 'Please select a rating star..', type: 'negative' });

    if (feedback.length > 5000) {
        return res.json({ message: 'Please write feedback within 5000 characters.', type: 'negative' });
    }
    feedback = feedback.toLowerCase();
    itemId = itemId.toLowerCase();
    category = category.toLowerCase();
    subcategory = subcategory.toLowerCase();

    if (!userId) {
        feedbackData = {
            email: email,
            rating: rating,
            feedback: feedback,
            dateTime: getCurrentISTTime()
        };
    }
    else if (userId) {
        feedbackData = {
            userId: userId,
            rating: rating,
            feedback: feedback,
            dateTime: getCurrentISTTime()
        };
    }

    const feedbackId = generateUniqueId(32);
    const batch = req.firestore.batch();
    const query1 = req.firestore.collection('itemfeedback').doc('feedbacks').collection(itemId).doc(feedbackId);
    batch.set(query1, feedbackData );

    try {
        // const metaRef = req.firestore.collection('items').doc(category).collection(subcategory).doc(itemId);
        // const metaSnapshot = await metaRef.select('totalFeedbacks').get();
        // let metaData = metaSnapshot.exists ? metaSnapshot.data() : { totalFeedbacks: 0, };
        // metaData.totalFeedbacks ? metaData.totalFeedbacks++ : metaData.totalFeedbacks = 1;
              
        // batch.update(metaRef, metaData);
        await batch.commit();
        console.log("feedbackData saved with ID: ", feedbackId);

        return res.json({ message: `Feedback Submitted.`, type: 'positive' });

    } catch (error) {
        console.error("Error saving feedbackData: ", error);
        return res.json({ message: `Something went wrong to submit the feedback. Please try again.`, type: 'negative' });
    }
});

function capitalize(text) {
    if (!text) return ''; // Handle empty or undefined input
    return text.charAt(0).toUpperCase() + text.slice(1);
}

module.exports = router;
