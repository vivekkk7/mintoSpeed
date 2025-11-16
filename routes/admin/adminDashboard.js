const express = require('express');
const authenticateAdmin = require('../../middlewares/authenticateAdmin');
const { getTotalUsers } = require('../../databaseQuery/getTotalUsers');
const { getOrdersNum } = require('../../utilities/utility');

const path = require('path');
const router = express.Router();


// Admin dashboard
router.get('/', authenticateAdmin, async (req, res) => {
  if (!req.isAlphaToken) {
    return res.status(404).sendFile(path.join(__dirname, '../../', 'public', '404.html'));
  }

  let metaData = {};
  let metaDataLifeTimeOrder = {};
  let metaDataCompleted = {};
  let metaDataCancelled = {};
  let metaDataFeedbacks = {};
  let metaDataComplaints = {};
  let metaDataUsers = {};

  //order count
  try {
    const metaRef = req.firestore2.collection('a_meta').doc('ordersData');
    const metaSnapshot = await metaRef.get();

    metaData = metaSnapshot.exists ? metaSnapshot.data() : { lifeTimeOrders: 0, totalPendingOrders: 0, totalCancelledOrders: 0, totalCompletedOrders: 0, totalFeedbacks: 0, totalComplaints: 0,};
    metaDataUsers = await getTotalUsers();

    metaDataLifeTimeOrder = await getOrdersNum(req.firestore2, "lifetime_orders");
    console.log("LifeTime Orders Metadata:", metaDataLifeTimeOrder);
    
    metaDataCancelled = await getOrdersNum(req.firestore2, "cancelled_orders");
    console.log("Cancelled Orders Metadata:", metaDataCancelled);
    
    metaDataCompleted = await getOrdersNum(req.firestore2, "completed_orders");
    console.log("Completed Orders Metadata:", metaDataCompleted);
    
    metaDataFeedbacks = await getOrdersNum(req.firestore2, "total_feedbacks");
    console.log("Feedbacks Metadata:", metaDataFeedbacks);
    
    metaDataComplaints = await getOrdersNum(req.firestore2, "total_complaints");
    console.log("Complaints Metadata:", metaDataComplaints);
    
  } catch (error) {
    console.error('error:', error);
  }

  return res.render('admin/adminDashboard', { metaData, metaDataLifeTimeOrder, metaDataCancelled, metaDataCompleted, metaDataUsers, 
    metaDataComplaints, metaDataFeedbacks,
     admin: req.admin, nonce: res.locals.nonce, activePage: 'dashboard', user: "true", totalCart: 0 });

});


//logout
router.post('/logout', authenticateAdmin, async (req, res) => {
  if (!req.isAlphaToken) {
    return res.json({ message: 'Unauthorized access.', type: 'negative' });
  }
  //clear cookies
  res.clearCookie('alpha_token');
  return res.json({ message: '', type: 'positive' });
});


module.exports = router;