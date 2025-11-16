const express = require('express');
const authenticateAdmin = require('../../middlewares/authenticateAdmin');
const { timestampIntoString, getCurrentISTTime } = require('../../utilities/dateTime');
const { getOrdersNum } = require('../../utilities/utility');
const limit = 3;
const path = require('path');

const router = express.Router();

// Admin dashboard (protected route)
const fetchData = async (req, type, id) => {
    let contentData = [];
    let errorString = '';
    let metaData = {};

    let flagTitle = `total${type.charAt(0).toUpperCase() + type.slice(1)}s`;

    let query = req.firestore2.collection(type)
    .orderBy('dateTime', 'desc')
    .limit(limit);

    if(id){
        query = req.firestore2.collection(type).doc(id);
    }

    try {
        const metaRef = req.firestore2.collection('a_meta').doc('ordersData');
        const metaSnapshot = await metaRef.get();

        metaData = await getOrdersNum(req.firestore2, `total_${type}s`);
        metaData["all"] = metaSnapshot.exists ? metaSnapshot.data()[flagTitle] : 0;
       console.log("metaData[all] : " + metaData["all"]);
        const dataDocs = await query.get();

        if (!dataDocs.empty) {
            if(id){
                const dataItem = dataDocs.data();
                    contentData.push({
                        id: dataDocs.id,
                        time: timestampIntoString(dataItem.dateTime),
                        ...dataItem,
                    });
            }
            else {
                dataDocs.docs.forEach(doc => {
                    const dataItem = doc.data();
                    contentData.push({
                        id: doc.id,
                        time: timestampIntoString(dataItem.dateTime),
                        ...dataItem,
                    });

                    console.log("dataItem : " + dataItem);
                });
            }
        } else {
            errorString = `No ${type} orders found.`;
        }
    } catch (error) {
        console.error(`Error fetching ${type} orders:`, error);
        errorString = `Error fetching ${type} orders.`;
    }

    return { contentData, metaData, errorString };
};


// Route for complaint
router.get('/complaint', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    const id = req.query.id || null;
    const isValidString = (str) => !/[<>\/]/.test(str);

    if (id && !isValidString(id)) return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));

    const activePage = 'complaint';
    const activePageTitle = 'Complaints'
    
    const { contentData, metaData, errorString } = await fetchData(req, activePage, id);

    return res.render('admin/adminComplaint&Feedback', {
        nonce: res.locals.nonce,
        activePageTitle,
        contentData,
        metaData,
        errorString,
        activePage,
        flag: id,
    });
});


// Route for complaint
router.get('/feedback', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    const id = req.query.id || null;
    const isValidString = (str) => !/[<>\/]/.test(str);

    if (id && !isValidString(id)) return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));

    const activePage = 'feedback';
    const activePageTitle = 'Feedbacks'
    
    const { contentData, metaData, errorString } = await fetchData(req, activePage, id);

    return res.render('admin/adminComplaint&Feedback', {
        nonce: res.locals.nonce,
        activePageTitle,
        contentData,
        metaData,
        errorString,
        activePage,
        flag: id,
    });
});


module.exports = router;