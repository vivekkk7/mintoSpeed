const express = require('express');
const router = express.Router();
const { generateUniqueId } = require('../utilities/utility');
const { getCurrentISTTime } = require('../utilities/dateTime');
const admin = require('firebase-admin');

const setCartCookie = require('../middlewares/cartCookie');

router.get('/', setCartCookie, async (req, res) => {
    const signedUser = (req.isAccessToken && req.isLogged) ? 'true' : 'false';

    return res.render('feedback', { nonce: res.locals.nonce, activePage: 'feedback', user: signedUser });
});


//store feedback to database
router.post('/submit', async (req, res) => {
    let { email, rating, feedback } = req.body;
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
    if (!validateNumberInput(rating, 1)) return res.json({ message: 'Please select a rating star..', type: 'negative' });

    if (feedback.length > 5000) {
        return res.json({ message: 'Please write feedback within 5000 characters.', type: 'negative' });
    }
    feedback = convertToLowercase(feedback);


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

    const feedbackId = generateUniqueId(16);
    const batch = req.firestore2.batch();
    const query1 = req.firestore2.collection('feedback').doc(feedbackId);
    batch.set(query1, feedbackData);

    const metaRef = req.firestore2.collection('a_meta').doc('ordersData');

    const orderDate = getCurrentISTTime();
    const year = orderDate.getFullYear();
    const month = String(orderDate.getMonth() + 1).padStart(2, "0");
    const day = String(orderDate.getDate()).padStart(2, "0");
    const monthDocId = `${year}-${month}`;

    try {
        const metaSnapshot = await metaRef.get();

        let metaData = metaSnapshot.exists ? metaSnapshot.data() : { totalFeedbacks: 0, };
        metaData.totalFeedbacks = metaData.totalFeedbacks && metaData.totalFeedbacks > 0 ? metaData.totalFeedbacks + 1 : 1;

        const docRef = metaRef.collection("total_feedbacks").doc(monthDocId);

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

            let usermetaData = usermetaSnapshot.exists ? usermetaSnapshot.data() : { totalFeedbacks: 0, };
            usermetaData.totalFeedbacks = usermetaData.totalFeedbacks && usermetaData.totalFeedbacks > 0 ? usermetaData.totalFeedbacks + 1 : 1;

            const userdocRef = userMetaDataRef.collection("total_feedbacks").doc(monthDocId);

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

        let tokens = [];
        try {
            const snapshot = await req.firestore.collection("deliveryBoys").get();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.token) {
                    tokens.push(data.token);
                }
            });
        } catch (error) {
            console.error("Error fetching tokens: ", error);
            // return res.status(500).send("Error fetching delivery boy tokens.");
        }

        if (tokens.length === 0) {
            console.error("no tokens");
            // return res.status(200).send("No delivery boy tokens found.");
        }
        else{
            const message = {
                notification: {
                    title: "New Feedback Received",
                    body: `Feedback id #${feedbackId} has been added.`
                },
                tokens: tokens // List of FCM tokens
            };
    
            // Step 3: Send notifications using `sendEachForMulticast`
            try {
                const response = await admin.messaging().sendEachForMulticast(message);
                console.log("Notifications sent: ", response);
    
                // Handle invalid tokens (clean up Firestore if necessary)
                if (response.failureCount > 0) {
                    response.responses.forEach((resp, index) => {
                        if (!resp.success) {
                            console.error(`Failed to send to token: ${tokens[index]}`, resp.error);
                        }
                    });
                }
            } catch (error) {
                console.error("Error sending notifications: ", error);
                // res.status(500).send("Error sending notifications.");
            }
        }

        

        console.log("feedbackData saved with ID: ", feedbackId);

        return res.json({ message: `Feedback Submitted.`, type: 'positive' });

    } catch (error) {
        console.error("Error saving feedbackData: ", error);
        return res.json({ message: `Something went wrong to submit the feedback. Please try again.`, type: 'negative' });
    }
});

function convertToLowercase(input) {
    return input.toLowerCase();
}
module.exports = router;