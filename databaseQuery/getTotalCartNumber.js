const { getCurrentISTTime } = require('../utilities/dateTime');

const getTotalCartItems = async (firestore, userId) => {
    let monthsAgo = getCurrentISTTime();
    monthsAgo.setMonth(monthsAgo.getMonth() - 6); // Go back 6 months
    try {
        const cartItemsSnapshot = await firestore
            .collection("cart")
            .doc(userId)
            .collection("cartItems")
            .where("dateTime", ">=", monthsAgo)  // Filter by the 6 month
            .get();

        const totalCartItems = cartItemsSnapshot.size;  // Get the count of documents

        console.log('totalCartItems inside function:', totalCartItems); // Check the actual value

        return totalCartItems;
    } catch (error) {
        console.error("Error retrieving cart items: ", error);
        console.log('totalCartItems inside function: 0'); // Check the actual value
        return 0;
    }
};


module.exports = { getTotalCartItems };
