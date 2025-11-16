const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
// Import and configure dayjs with customParseFormat
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const { body, validationResult } = require('express-validator');
const { getCurrentISTTime } = require('../utilities/dateTime');

const { convertToGrams, generateUniqueId, fetchManyItems } = require('../utilities/utility');
const fetchSectionQuantity = 2;
const maxageTime = 12 * 60 * 60 * 1000; //12 hours
const { generateAuthToken, generateAccessToken } = require('../middlewares/authenticateMiddleWares');
const accessTokenValidTime = 12 * 60 * 60 * 1000; //12 hours
const maxageTimeForUserId = 6 * 30 * 24 * 60 * 60 * 1000; // 6 months

const setCartCookie = require('../middlewares/cartCookie');


const validateCatSubCat = [
    body('category')
        .matches(/^[^<>/]*$/).withMessage('Category must not contain <, >, or /'),
    body('subCategory')
        .matches(/^[^<>/]*$/).withMessage('SubCategory must not contain <, >, or /'),
];

// Route to render initial grocery page with EJS
router.get('/', setCartCookie, async (req, res) => {
    console.log("req.isAccessToken : " + req.isAccessToken + ", req.userId : " + req.userId + ", req.isLogged : " + req.isLogged);
    const firestore = req.firestore;
    let userId = (req.isAccessToken && req.userId) ? req.userId : null;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';

    let totalCartItem = req.totalCart || 0;
    let documentIds = [];
    let trendItems = [];

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


    //fetch trending items
    try{
        let query = firestore.collection("trendingItems").orderBy('dateTime', 'desc');
        const items = await fetchManyItems(query, 0, null);

        trendItems.push({
            items: items.items,
            lastVisible: items.lastVisible
        });
    } 
    catch(err){
        console.error("Error in trending items :", err);
    }



    // Fetch first 5 categories
    try {
        const categoriesSnapshot = await firestore.collection('items').limit(fetchSectionQuantity).get();
        const initialCategories = [];

        for (const categoryDoc of categoriesSnapshot.docs) {
            const categoryName = categoryDoc.id;

            // Fetch the first subcategory and its items
            const subcategories = await fetchFirstSubcategoryWithItems(req, res, categoryDoc, firestore);
            initialCategories.push({
                id: categoryName,
                subcategories
            });
        }

        // Render initial data with EJS
        return res.render('index', { nonce: res.locals.nonce, activePage: 'home', user: signedUser, totalCart: totalCartItem, categories: initialCategories, categoryNames: documentIds, trendItems });
    } catch (error) {
        console.error('Error fetching categories:', error);
        return res.render('index', { nonce: res.locals.nonce, activePage: 'home', user: signedUser, totalCart: totalCartItem });
    }
});

// Helper function to fetch the first subcategory with limited items
async function fetchFirstSubcategoryWithItems(req, res, categoryDoc, firestore) {
    const subcategoriesSnapshot = await categoryDoc.ref.listCollections();
    const subcategories = [];

    console.log("fetchFirstSubcategoryWithItems");
    for (let i = 0; i < subcategoriesSnapshot.length; i++) {
        const subcategory = subcategoriesSnapshot[i];

        if (i === 0) {
            // For the first subcategory, fetch items
            let query = firestore.collection('items').doc(categoryDoc.id).collection(subcategory.id);
            const items = await fetchManyItems(query, 0, null);

            subcategories.push({
                id: subcategory.id,
                items: items.items,
                lastItem: items.lastVisible
            });
        } else {
            // For other subcategories, only store the id
            subcategories.push({
                id: subcategory.id,
                items: [],
                lastItem: null
            });
        }
    }

    return subcategories;
}



// Load more categories or subcategories dynamically on scroll
router.post('/load_more_sections',
    [
        body('lastVisible').matches(/^[^<>/]*$/).withMessage('Invalid character obtained while loading.'),
        body('headCategoryName').optional().matches(/^[^<>/]*$/).withMessage('Invalid characters obtained while loading.'),
    ],
    async (req, res) => {

        console.log("load more Items called");

        // Validate input
        if (!validationResult(req).isEmpty())
            return res.json({ message: validationResult(req).array()[0].msg, type: 'negative' });

        try {
            const firestore = req.firestore;
            const { lastVisible, headCategoryName } = req.body; // Get lastVisible and headCategoryName from request body

            let query = firestore.collection('items').limit(fetchSectionQuantity);

            if (lastVisible) {
                // Get the document from which to start
                const lastVisibleDoc = await firestore.collection('items').doc(lastVisible).get();
                query = query.startAfter(lastVisibleDoc);
            }

            const categoriesSnapshot = await query.get();
            const additionalCategories = [];

            for (const categoryDoc of categoriesSnapshot.docs) {
                const categoryName = categoryDoc.id;

                // Exclude the category matching headCategoryName (if provided)
                if (!headCategoryName || categoryName !== headCategoryName) {
                    const subcategories = await fetchFirstSubcategoryWithItems(req, res, categoryDoc, firestore);
                    additionalCategories.push({
                        id: categoryName,
                        subcategories
                    });
                }
            }

            // If no categories were found, return an empty response
            if (additionalCategories.length === 0) {
                return res.json({ categories: [] });
            }

            // Return the last document ID for the next request
            const lastVisibleDocument = categoriesSnapshot.docs[categoriesSnapshot.docs.length - 1];
            return res.json({ categories: additionalCategories, lastVisible: lastVisibleDocument.id });
        } catch (error) {
            console.error('Error fetching additional sections:', error);
            return res.json({ message: 'Failed to load new categories.', type: 'negative' });
        }
    });



router.post('/get_grocery_items', validateCatSubCat, async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.json({ message: validationResult(req).array()[0].msg, type: 'negative' });

    try {
        console.log('Request Body:', req.body);
        let { category, subCategory } = req.body;
        category = convertToLowercase(category);
        subCategory = convertToLowercase(subCategory);

        // Validate category and subCategory inputs
        const validateInput = (input) => typeof input === 'string';

        if (!validateInput(category)) {
            return res.json({ message: 'Invalid item category.', type: 'negative' });
        }
        if (!validateInput(subCategory)) {
            return res.json({ message: 'Invalid item subCategory.', type: 'negative' });
        }

        // Reference to items collection in Firestore
        const query = req.firestore
            .collection('items')
            .doc(category)
            .collection(subCategory);

        const itemsData = await fetchManyItems(query, 0, null);

        return res.json({ items: itemsData.items, lastKey: itemsData.lastVisible });
    } catch (err) {
        console.error('Error fetching grocery items:', err);
        return res.json({ message: 'Error fetching grocery items.', type: 'negative' });
    }
});


const validateItemCatSubCat = [
    body('itemCategory')
        .matches(/^[^<>/]+$/)
        .withMessage('Category must not contain <, >, or /'),
    body('itemSubCategory')
        .matches(/^[^<>/]+$/)
        .withMessage('SubCategory must not contain <, >, or /'),
    body('itemName')
        .matches(/^[^<>/]*$/)
        .withMessage('Item Name must not contain <, >, or /'),
    body('itemWeight')
        .custom((value) => {
            if (!isNaN(value) && (typeof value === 'number' || !isNaN(parseFloat(value)))) {
                return true; // Plain number or decimal is valid
            }
            if (typeof value === 'string' && /^\d+(\.\d+)?\s*(kg|gm)$/i.test(value)) {
                return true; // Valid string with unit
            }
            throw new Error('Weight must be a number (e.g., "500") or a string with a valid unit like "500 kg", "500 gm", or "2.5 lbs".');
        }),
];

// Backend: /add_to_cart endpoint
router.post('/add_to_cart', validateItemCatSubCat, async (req, res) => {
    if (!validationResult(req).isEmpty()) return res.json({ message: validationResult(req).array()[0].msg, type: 'negative' });

    let { itemName, itemWeight, itemCategory, itemSubCategory } = req.body;
    let userId = (req.isAccessToken && req.userId) ? req.userId : null;

    if (!userId) {
        try {
            userId = generateUniqueId(64);
            const loginTime = Date.now();

            //adding sessions and cookies
            const authToken = generateAuthToken(userId, "null", loginTime);

            res.cookie('auth_token', authToken, {
                maxAge: maxageTimeForUserId,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
                sameSite: 'Strict'
            });

            //store session data
            const accept_lg = req.headers['accept-language'];
            const userAgent = req.headers['user-agent'];
            const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress;
            console.log('Client IP:', ip);
            console.log('currentUserAgent:', userAgent);
            console.log('Accept-Language:', accept_lg);

            const isLogIn = false;

            req.session.metadata = {
                userId: userId,
                accept_lg,
                userAgent,
                ip,
                isLogIn: isLogIn,
                loginTime,
            };

            //access token
            const accessToken = generateAccessToken(userId, accept_lg, userAgent, ip, isLogIn, Date.now());

            res.cookie('access_token', accessToken, {
                maxAge: accessTokenValidTime,
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
                sameSite: 'Strict'
            });

            console.log("cookies and session metadata added: " + req.session.metadata);
        } catch (error) {
            console.error('UserId not added:', error);
            return res.json({ message: 'Error adding item to cart. Login to your account to add cart.', type: 'negative' });
        }
    }

    let totalCartItem = 0;

    // Validation
    const validateInput = (name, value) => {
        if (!value || typeof value !== 'string') {
            console.log(`error: ${name}: ${value}`);
            return res.json({ message: `Something went wrong. Item name issue occur.`, type: 'negative' });
        }
        return true;
    };

    if (![itemName, itemWeight, itemCategory, itemSubCategory].every((val, i) => validateInput(['item name', 'item weight', 'item category', 'item subcategory'][i], val))) {
        return;
    }

    itemName = itemName.trim().toLowerCase();
    itemCategory = itemCategory.trim().toLowerCase();
    itemSubCategory = itemSubCategory.trim().toLowerCase();
    itemWeight = itemWeight.trim();

    try {
        const itemRef = req.firestore.collection('items').doc(itemCategory).collection(itemSubCategory).doc(itemName);
        const itemSnapshot = await itemRef.get();

        if (!itemSnapshot.exists) {
            console.log(`Product ${itemName} not found in our category.`);
            return res.json({ message: `${itemName} not found in our category.`, type: 'negative' });
        }

        const data = itemSnapshot.data();
        const { packed } = data;

        // Determine weights
        const [minWeight, maxWeight] = packed ?
            [parseInt(data.min), parseInt(data.max)] :
            [convertToGrams(data.min), convertToGrams(data.max)];
        const itemVol = packed ? parseInt(itemWeight) : convertToGrams(itemWeight);

        if (itemVol >= minWeight && itemVol <= maxWeight) {
            const cartItemData = {
                name: itemName,
                volume: itemWeight,
                category: itemCategory,
                subCategory: itemSubCategory,
                dateTime: getCurrentISTTime()
            };

            // Reference to the user's cart for the given date
            const cartRef = req.firestore2.collection('cart').doc(userId).collection('cartItems');

            try {
                await cartRef.add(cartItemData);
            } catch (error) {
                console.error('Error adding item to cart:', error); // Log the error for debugging
                if (error.code === 'permission-denied') {
                    return res.json({ message: 'Permission denied. Unable to add item to cart.', type: 'negative' });
                } else if (error.code === 'not-found') {
                    return res.json({ message: 'User cart not found. Please check the user ID.', type: 'negative' });
                } else {
                    return res.json({ message: 'Internal server error. Please try again later.', type: 'negative' });
                }
            }


            // update totalCart cookie
            const totalCart = req.cookies.totalCart;

            if (totalCart) {
                console.log(`add item totalCart is ${totalCart}`);
                totalCartItem = parseInt(totalCart, 10) + 1;
                res.cookie('totalCart', (parseInt(totalCart, 10) + 1), {
                    maxAge: maxageTime,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',  // Uncomment if needed
                    sameSite: 'Strict'
                });

            } else {
                console.log('add item No totalCart cookie found');

                //get totalCart data from database
                try {
                    totalCartItem = 1;
                    res.cookie('totalCart', 1, {
                        maxAge: maxageTime,
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',  // Uncomment if needed
                        sameSite: 'Strict'
                    });


                } catch (error) {
                    totalCartItem = 1;
                    console.error(" add item Error retrieving cookie:", error);
                    res.cookie('totalCart', 1, {
                        maxAge: maxageTime,
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'Strict'
                    });
                }
            }

            console.log('Item successfully added to cart!');

            return res.json({
                totalCart: totalCartItem,
                message: 'Item added to cart successfully.',
                type: 'positive',
            });

        } else {
            return res.json({ message: 'Invalid item weight or quantity.', type: 'negative' });
        }
    } catch (error) {
        console.error('Error adding item to cart:', error);
        return res.json({ message: 'Error adding item to cart.', type: 'negative' });
    }
});

function convertToLowercase(input) {
    return input.toLowerCase();
}
module.exports = router;
