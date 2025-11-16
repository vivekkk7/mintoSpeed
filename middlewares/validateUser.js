const admin = require("firebase-admin");

module.exports = (req, res, next) => {
    const userId = req.cookies.userId;

    if (!userId) {
        req.userIdExit = false;
        return next();                  
    }

    try {
        admin.auth().getUser(userId)
            .then((userRecord) => {
                req.userId = userId;
                req.userIdExit = true;
                return next();                  
            })
            .catch((error) => {
                console.error("Error fetching user data validation:", error);
                req.userIdExit = false;
                return next();                  
            });
    } catch (error) {
        req.userIdExit = false;
        return next();                  
    }
};