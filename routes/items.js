const express = require('express');
const router = express.Router();
// Import and configure dayjs with customParseFormat
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const { body, validationResult, query } = require('express-validator');
const path = require('path');
const { fetchManyItems } = require('../utilities/utility');


const fetchSectionQuantity = 1;

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
    .optional() 
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
    const querySubCategory = req.query.s || null;
    let totalCartItem = req.totalCart || 0;
    let selectedCategory = [];
    let documentIds = [];


    if (!queryCategory) {
        return res.status(404).sendFile(path.join(__dirname, '../', 'public', '404.html'));    
    }

    console.log("query i : " + queryCategory);
    const favName = querySubCategory ? capitalize(querySubCategory) + " - " + capitalize(queryCategory) : capitalize(queryCategory);

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


    try {
        // Fetch selected category
        const categorySnapshot = await firestore.collection('items').doc(queryCategory).get();

        const subcategory = await fetchFirstSubcategoryWithItems(req, res, categorySnapshot, firestore, querySubCategory);
        selectedCategory.push({
            id: queryCategory,
            subcategory        
        });

 
        return res.render('items', { nonce: res.locals.nonce, activePage: 'items', favName, user: signedUser, totalCart: totalCartItem,  selectedCategory: selectedCategory, categoryNames: documentIds });
        
    } catch (error) {
        console.error('Error fetching categories2:', error);
        return res.status(404).sendFile(path.join(__dirname, '../', 'public', '404.html'))
    }
});

// Helper function to fetch the first subcategory with limited items
async function fetchFirstSubcategoryWithItems(req, res, categoryDoc, firestore, querySubCategory) {
    const subcategoriesSnapshot = await categoryDoc.ref.listCollections();
    const subcategories = [];
    let flag = 0;
    console.log("fetchFirstSubcategoryWithItems");
    for (let i = 0; i < subcategoriesSnapshot.length; i++) {
        const subcategory = subcategoriesSnapshot[i];

        if(subcategory.id == querySubCategory){
            flag = i;
            console.log("flag checked : " + i);
        }
    }

    for (let i = 0; i < subcategoriesSnapshot.length; i++) {
        const subcategory = subcategoriesSnapshot[i];

        if (i == flag) {
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

    return {subcategories, flag};
}


function capitalize(text) {
    if (!text) return ''; // Handle empty or undefined input
    return text.charAt(0).toUpperCase() + text.slice(1);
}

module.exports = router;
