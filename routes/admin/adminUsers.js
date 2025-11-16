const express = require('express');
const authenticateAdmin = require('../../middlewares/authenticateAdmin');
const { timestampIntoString, getCurrentISTTime } = require('../../utilities/dateTime');
// const { getOrdersNum } = require('../../utilities/utility');
const { getTotalUsers } = require('../../databaseQuery/getTotalUsers');
const limit = 2;
const path = require('path');
const router = express.Router();

// Admin dashboard (protected route)
const fetchData = async (req, element, id) => {
    let contentData = [];
    let errorString = '';
    let metaData = {};

    let query = req.firestore.collection('users')
    .orderBy('signupOn', 'desc')
    .limit(limit);

    if(id){
        query = req.firestore.collection('users').doc(id);
    }

    try {
        metaData = await getTotalUsers();
       
        const orderDocs = await query.get();

        if (!orderDocs.empty) {
            if(id){
                const orderData = orderDocs.data();
                    contentData.push({
                        id: orderDocs.id,
                        signupon: timestampIntoString(orderData.signupOn),
                        createdon: timestampIntoString(orderData.createdOn),
                        ...orderData,
                    });
            }
            else {
                orderDocs.docs.forEach(doc => {
                    const orderData = doc.data();
                    contentData.push({
                        id: doc.id,
                        signupon: timestampIntoString(orderData.signupOn),
                        createdon: timestampIntoString(orderData.createdOn),
                        ...orderData,
                    });
                });
            }
        } else {
            errorString = `No ${element}  found.`;
        }
    } catch (error) {
        console.error(`Error fetching ${element} :`, error);
        errorString = `Error fetching ${element} .`;
    }

    return { contentData, metaData, errorString };
};


// Route
router.get('/', authenticateAdmin, async (req, res) => {
    if (!req.isAlphaToken) {
        return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
    }
    const id = req.query.id || null;
    const isValidString = (str) => !/[<>\/]/.test(str);

    if (id && !isValidString(id)) return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));

    const activePage = 'users';
    const activePageTitle = 'Users Profile'
    
    const { contentData, metaData, errorString } = await fetchData(req, activePage, id);

    return res.render('admin/adminUserProfiles', {
        nonce: res.locals.nonce,
        activePageTitle,
        contentData,
        metaData,
        errorString,
        activePage,
        flag: id,
    });
});



function convertToLowercase(input) {
  return input.toLowerCase();
}
  

module.exports = router;