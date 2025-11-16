const { getTotalCartItems } = require('../databaseQuery/getTotalCartNumber');
const maxageTime = 24 * 60 * 60 * 1000; // 1 days

// Middleware to set and fetch totalCart value
module.exports = async (req, res, next) => {
    let userId = (req.isAccessToken && req.userId) ? req.userId : null;

    // If neither userId nor tempId is present, skip setting the cookie
    if (!userId) {
        console.log("No userId found.");
        res.cookie('totalCart', 0, {
            maxAge: 1,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
            sameSite: 'Strict',
        });
        req.totalCart = 0; // Set default value
        return next();
    }

    const totalCart = req.cookies.totalCart;

    if (totalCart) {
        console.log(`totalCart cookie already exists: ${totalCart}`);
        req.totalCart = parseInt(totalCart, 10); // Attach the value to req
        return next();
    }

    console.log("No totalCart cookie found. Fetching from database...");

    try {
        // Wait for the database operation to complete
        const totalCartItem = await getTotalCartItems(req.firestore2, userId);

        // Set the totalCart cookie with the fetched value
        res.cookie('totalCart', totalCartItem, {
            maxAge: maxageTime,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
            sameSite: 'Strict',
        });

        console.log(`totalCart set to ${totalCartItem}`);
        req.totalCart = totalCartItem; // Attach the value to req
        return next();
    } catch (error) {
        console.error("Error retrieving totalCartItem:", error);

        // Set the totalCart cookie to 0 in case of an error
        res.cookie('totalCart', 0, {
            maxAge: maxageTime,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',  // Sends the cookie only over HTTPS in production
            sameSite: 'Strict',
        });
    }
    req.totalCart = 0; // Set default value in case of error
    return next();
};
