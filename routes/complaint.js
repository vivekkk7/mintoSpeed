const express = require('express');
const router = express.Router();
const complaintSubmitUser = require('../controllers/complaintSubmitUser');
const complaintSubmitAgent = require('../controllers/complaintSubmitAgent');
const { generateUniqueId } = require('../utilities/utility');
const setCartCookie = require('../middlewares/cartCookie');
const { getCurrentISTTime, dateTimeForRealTimeDatabase } = require('../utilities/dateTime');
const admin = require('firebase-admin');


router.get('/', setCartCookie, async (req, res) => {
    let totalCartItem = req.totalCart || 0;
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';

    return res.render('complaint', { nonce: res.locals.nonce, activePage: 'complaint', user: signedUser, totalCart: totalCartItem });
});


//store complaint to database
router.post('/submit', async (req, res) => {
    let { email, selectedOption, feedback } = req.body;
    let userId = (req.isAccessToken && req.userId) ? req.userId : null;
    let complaintData = {};
    let userEmail = email;


    const isValidString = (str) => typeof str === 'string' && /^[a-zA-Z0-9_\- &]+$/.test(str);

    if (!email == null) {
        if (!/\S+@\S+\.\S+/.test(email)) {
            return res.json({ message: `Email is not valid.`, type: 'negative' });
        }
        email = email.toLowerCase();
    }
    if (/[#\[\]<>]/.test(feedback) || feedback.length < 1) {
        return res.json({ message: 'Blank or Input contains harmful characters like #, [, ], < or >.', type: 'negative' });
    }
    if (!isValidString(selectedOption)) return res.json({ message: 'Please select an option.', type: 'negative' });

    if (feedback.length > 5000) {
        return res.json({ message: 'Please write complaint within 5000 characters.', type: 'negative' });
    }
    feedback = convertToLowercase(feedback);

    if (!userId) {
        complaintData = {
            email: email,
            reason: selectedOption,
            detail: feedback,
            dateTime: getCurrentISTTime()
        };
        userEmail = email;
    }
    else if (userId) {
        complaintData = {
            userId: userId,
            reason: selectedOption,
            detail: feedback,
            dateTime: getCurrentISTTime()
        };


        try {
            const userRef = req.firestore.collection('users').doc(userId);
            const userSnapshot = await userRef.get();

            userEmail = userSnapshot.data().email;
            console.log("userEmail " + userEmail);

        } catch (error) {
            console.error('User not found to database:', error); // Log the error for debugging
            return res.json({ message: 'User not found. Please try again.', type: 'negative' });
        }
    }

    const complaintId = generateUniqueId(15);
    const batch = req.firestore2.batch();
    const query1 = req.firestore2.collection('complaint').doc(complaintId);
    batch.set(query1, complaintData);

    const metaRef = req.firestore2.collection('a_meta').doc('ordersData');

    const orderDate = getCurrentISTTime();
    const timeforEmail =dateTimeForRealTimeDatabase(orderDate);
    const year = orderDate.getFullYear();
    const month = String(orderDate.getMonth() + 1).padStart(2, "0");
    const day = String(orderDate.getDate()).padStart(2, "0");
    const monthDocId = `${year}-${month}`;
    try {
        const metaSnapshot = await metaRef.get();

        let metaData = metaSnapshot.exists ? metaSnapshot.data() : { totalComplaints: 0, };
        metaData.totalComplaints = metaData.totalComplaints && metaData.totalComplaints > 0 ? metaData.totalComplaints + 1 : 1;

        const docRef = metaRef.collection("total_complaints").doc(monthDocId);

        batch.set(
            docRef,
            {
                this_month: admin.firestore.FieldValue.increment(1),
                [day]: admin.firestore.FieldValue.increment(1)
            },
            { merge: true }
        );

        batch.update(metaRef, metaData);

        //byuserid
        if (userId) {
            const userMetaDataRef = req.firestore2.collection('orderByUserId').doc(userId);
            const usermetaSnapshot = await userMetaDataRef.get();

            let usermetaData = usermetaSnapshot.exists ? usermetaSnapshot.data() : { totalComplaints: 0, };
            usermetaData.totalComplaints = usermetaData.totalComplaints && usermetaData.totalComplaints > 0 ? usermetaData.totalComplaints + 1 : 1;

            const userdocRef = userMetaDataRef.collection("total_complaints").doc(monthDocId);

            batch.set(
                userdocRef,
                {
                    this_month: admin.firestore.FieldValue.increment(1),
                    [day]: admin.firestore.FieldValue.increment(1)
                },
                { merge: true }
            );

            batch.set(userMetaDataRef, usermetaData, { merge: true });
        }


        await batch.commit();

        //send submit email to agent
        complaintSubmitAgent.complaintSubmit(complaintData, userEmail, complaintId, timeforEmail)
            .then(() => {
                console.log("Complaint email sent to agent.");
            })
            .catch((error) => {
                console.error(" Complaint Email error :" + error);
            });
        //send submit email to user
        complaintSubmitUser.complaintSubmit(complaintData, userEmail, complaintId, timeforEmail)
            .then(() => {
                console.log("Complaint email sent to user.");
            })
            .catch((error) => {
                console.error(" Complaint Email error :" + error);
            });


        return res.json({ message: `Complaint Submitted.`, type: 'positive' });

    } catch (error) {
        console.error("Error saving complaintData: ", error);
        return res.json({ message: `Something went wrong to submit the complaint. Please try again.`, type: 'negative' });
    }
});
function convertToLowercase(input) {
    return input.toLowerCase();
}

module.exports = router;