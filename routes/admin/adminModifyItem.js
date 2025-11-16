const express = require('express');
const authenticateAdmin = require('../../middlewares/authenticateAdmin');

const router = express.Router();
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const bucket = admin.storage().bucket();
const path = require('path');

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve the main page (index.ejs)
router.get('/', authenticateAdmin, (req, res) => {
    if(!req.isAlphaToken){
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    return res.render('admin/adminModifyItem', { nonce: res.locals.nonce });
});



// Route to handle adding a new item
router.post('/modify-item', authenticateAdmin, upload.single('itemImage'), async (req, res) => {
    if(!req.isAlphaToken){
        return res.json({ success: false, message: "Unauthorized Access." });
    }
    try {
        let { itemName, category, subcategory, minQty, maxQty, popularQty, popularPrice, packed, weightPriceCombinations, itemAbout, replaceSelect, popularMRP, newItemName } = req.body;
        const isValidString = (str) => !/[<>\/]/.test(str);
        const isValidNumber = (num) => !isNaN(num) && num > 0;
    
        if (!isValidString(itemName)) return res.json({ success: false, message: 'Invalid < > / characters or missing itemName.' });
        if (newItemName && !isValidString(newItemName)) return res.json({ success: false, message: 'Invalid < > / characters or missing newItemName.' });
        if (!isValidString(category)) return res.json({ success: false, message: 'Invalid < > / characters or missing category.' });
        if (!isValidString(subcategory)) return res.json({ success: false, message: 'Invalid < > / characters or missing subcategory.' });
        if (!isValidNumber(parseInt(minQty))) return res.json({ success: false, message: 'Invalid < > / characters or missing minQty.' });
        if (!isValidNumber(parseInt(maxQty))) return res.json({ success: false, message: 'Invalid < > / characters or missing maxQty.' });
        if (!isValidNumber(parseInt(popularQty))) return res.json({ success: false, message: 'Invalid < > / characters or missing popularQty.' });
        if (!isValidNumber(parseFloat(popularPrice))) return res.json({ success: false, message: 'Invalid < > / characters or missing popularPrice.' });
        if (typeof packed !== 'string' || !['true', 'false'].includes(packed)) return res.json({ success: false, message: 'Invalid packed value.' });

        if (typeof replaceSelect !== 'string' || !['true', 'false'].includes(replaceSelect)) return res.json({ success: false, message: 'Invalid replacement value.' });

        try {
            JSON.parse(weightPriceCombinations);
        } catch (error) {
            return res.json({ success: false, message: 'Invalid or missing weightPriceCombinations.' });
        } 
        
        itemName = convertToLowercase(itemName);
        category = convertToLowercase(category);
        subcategory = convertToLowercase(subcategory);

        let imageUrl = '';
        let updateData;
        
        if (req.file && req.file.size > 0) {
            const filename = `images/${uuidv4()}-${req.file.originalname}`;
            const file = bucket.file(filename);

            await file.save(req.file.buffer, {
                metadata: { contentType: req.file.mimetype },
                public: true
            });

            imageUrl = file.publicUrl();
            updateData = {
                min: minQty,
                max: maxQty,
                qty: popularQty,
                price: popularPrice,
                packed: packed === 'true',
                img: imageUrl,
                options: weightPriceCombinations,
                itemAbout: itemAbout,
                replaceSelect: replaceSelect,
                popularMRP: popularMRP || ''
            }
        }
        else{
            updateData = {
                min: minQty,
                max: maxQty,
                qty: popularQty,
                price: popularPrice,
                packed: packed === 'true',
                options: weightPriceCombinations,
                itemAbout: itemAbout,
                replaceSelect: replaceSelect,
                popularMRP: popularMRP || ''
            }
        }

        const db = req.firestore;

        // 1. Create placeholder document at `items/{category}` level if it doesn't exist
        const categoryRef = db.collection('items').doc(category);        
        await categoryRef.collection(subcategory).doc(itemName).update(updateData);

        newItemName = convertToLowercase(newItemName);

        //change name of item
        if(newItemName && newItemName != "null" && newItemName.length > 2 && newItemName != itemName){
            try{
                console.log("new item name added");
                await renameItem(category, subcategory, itemName, newItemName);
            }catch(err){
                return res.json({ success: false, message: "New item name not changed." });
            }
        }
        async function renameItem(category, subcategory, oldItemName, newItemName) {
            try {
                // References for `items` collection
                const oldItemRef = db.collection('items')
                    .doc(category)
                    .collection(subcategory)
                    .doc(oldItemName);
        
                const newItemRef = db.collection('items')
                    .doc(category)
                    .collection(subcategory)
                    .doc(newItemName);
        
                
                // Use batch for atomic operations
                const batch = db.batch();
        
                // Rename in `items` collection
                const oldItemSnapshot = await oldItemRef.get();
                if (oldItemSnapshot.exists) {
                    batch.set(newItemRef, oldItemSnapshot.data()); // Copy data to new document
                    batch.delete(oldItemRef);                     // Delete the old document
                } else {
                    console.error(`Document ${oldItemName} not found in items collection.`);
                }
        
                // Commit the batch
                await batch.commit();
                console.log(`Item renamed from "${oldItemName}" to "${newItemName}" in both collections.`);
            } catch (error) {
                console.error("Error renaming item:", error);
            }
        }        

        return res.json({ success: true });
    } catch (error) {
        console.error("Error adding item:", error);
        return res.json({ success: false, message: error.message });
    }
});



// Route to get categories
router.post('/get-categories', authenticateAdmin, async (req, res) => {
    if(!req.isAlphaToken){
        return res.status(404).json({ error: 'Unauthorized access.' });
    }
    console.log("Fetching categories...");  // Logs when the route is reached
    try {
        const db = req.firestore;
        
        const categoriesSnapshot = await db.collection('items').select().get();
        
        if (categoriesSnapshot.empty) {
            console.error("No categories data found in Firestore.");
            return res.status(404).json({ error: 'No categories found' });
        }
        const documentIds = categoriesSnapshot.docs.map((doc) => doc.id);

        return res.json(documentIds);
    } catch (error) {
        console.error("Error in /get-categories route:", error);
        return res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

// Route to get subcategories for a specific category
router.post('/get-subcategories', authenticateAdmin, async (req, res) => {
    if(!req.isAlphaToken){
        return res.status(404).json({ error: 'Unauthorized access.' });
    }

    let { category } = req.body;

    if (!category) {
        return res.status(400).json({ error: 'Category is required' });
    }
    category = convertToLowercase(category);
    try {
        const subcategoriesSnapshot = await req.firestore.collection('items').doc(category).listCollections();

        const subcategories = subcategoriesSnapshot.map((subcat) => subcat.id);  // Each sub-collection represents a subcategory
        return res.json(subcategories);
    } catch (error) {
        console.error("Error in /get-subcategories route:", error);
        return res.status(500).json({ error: 'Failed to fetch subcategories' });
    }
});


//get items
router.post('/get-items', authenticateAdmin, async (req, res) => {
    if(!req.isAlphaToken){
        return res.status(404).json({ error: 'Unauthorized access.' });
    }
    
    console.log("Fetching items...");  // Logs when the route is reached
    let { category, subcategory } = req.body;

    if (!category || !subcategory) {
        return res.status(400).json({ error: 'Category or subcategory is required' });
    }
        category = convertToLowercase(category);
        subcategory = convertToLowercase(subcategory);
    try {
        const db = req.firestore;
        
        const itemsSnapshot = await db.collection('items').doc(category).collection(subcategory).select().get();
        
        if (itemsSnapshot.empty) {
            console.error("No items data found in Firestore.");
            return res.status(404).json({ error: 'No items found' });
        }
        const documentIds = itemsSnapshot.docs.map((doc) => doc.id);

        return res.json(documentIds);
    } catch (error) {
        console.error("Error in /get-items route:", error);
        return res.status(500).json({ error: 'Failed to fetch items.' });
    }
});


//load item
router.post('/load-item', authenticateAdmin, async (req, res) => {
    console.log("Loading items...");  // Logs when the route is reached
    let { category, subcategory, itemName } = req.body;

    if (!category || !subcategory || !itemName) {
        return res.status(400).json({ error: 'Category or subcategory or itemName is required' });
    }
    itemName = convertToLowercase(itemName);
        category = convertToLowercase(category);
        subcategory = convertToLowercase(subcategory);
    try {
        const db = req.firestore;
        
        const itemSnapshot = await db.collection('items').doc(category).collection(subcategory).doc(itemName).get();
        
        if (!itemSnapshot.exists) {
            console.error("No items data found in Firestore.");
            return res.status(404).json({ error: 'No items found' });
        }
        const itemData = itemSnapshot.data();


        return res.json(itemData);
    } catch (error) {
        console.error("Error in /get-items route:", error);
        return res.status(500).json({ error: 'Failed to fetch items.' });
    }
});

function convertToLowercase(input) {
    return input.toLowerCase();
}

module.exports = router;