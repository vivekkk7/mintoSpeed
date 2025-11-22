require("dotenv").config();
const express = require('express');
const session = require('express-session');
const app = express();
const path = require('path');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid'); // Unique user IDs
const admin = require('firebase-admin');

const cors = require('cors');

app.use(cors({
    origin: "https://mintospeed-fnb5.onrender.com", // Allow requests from your frontend
    methods: ["GET", "POST"],
    credentials: true // Allow sending cookies and authentication headers
}));


//real time update
const http = require("http");
const { Server } = require("socket.io");
const server = http.createServer(app);
// const io = new Server(server);
// const io = new Server(server, { transports: ['websocket'] });
const io = new Server(server, {
    cors: {
        origin: "https://mintospeed-fnb5.onrender.com", // Replace with your frontend domain
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ["websocket"] // Force WebSocket transport
});



// Generate a nonce and set CSP headers dynamically
app.use((req, res, next) => {
    const nonce = crypto.randomBytes(32).toString('base64');
    res.locals.nonce = nonce;
    res.setHeader('Content-Security-Policy', `
        default-src 'self';
        script-src 'self' https://kit.fontawesome.com https://ajax.googleapis.com https://cdnjs.cloudflare.com 'nonce-${nonce}' https://www.google.com https://www.gstatic.com https://cdn.jsdelivr.net/npm/algoliasearch https://algolia.com https://08vh7s7two.algolia.net https://08vh7s7two-dsn.algolia.net https://08vh7s7two-2.algolianet.com https://08vh7s7two-3.algolianet.com https://08vh7s7two-1.algolianet.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/;
        style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com;
        font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com https://ka-f.fontawesome.com;
        connect-src 'self' https://ka-f.fontawesome.com https://www.googleapis.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://algolia.com https://08vh7s7two.algolia.net https://08vh7s7two-dsn.algolia.net https://08vh7s7two-2.algolianet.com https://08vh7s7two-3.algolianet.com https://08vh7s7two-1.algolianet.com https://maps.googleapis.com wss://mintospeed-fnb5.onrender.com https://www.gstatic.com/recaptcha/ https://www.google.com/recaptcha/;
        img-src 'self' data: https://storage.googleapis.com https://firebasestorage.googleapis.com https://www.gstatic.com https://maps.gstatic.com https://maps.googleapis.com https://mapsresources-pa.googleapis.com;
        frame-src 'self' https://www.google.com https://www.gstatic.com;
        frame-ancestors 'self' https://www.google.com;    
    `.replace(/\n/g, ''));
    next();
});

app.set('trust proxy', true);

// Rate limiting
const limiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 4000, // Limit each IP to 100 requests per windowMs
    keyGenerator: (req) => req.ip, // Use req.ip for rate limiting
    message: 'Too many requests, please try again later.'
});
app.use(limiter);

// Middleware setup
app.use(express.json());
app.use(cookieParser());
app.use(helmet({
    contentSecurityPolicy: false  // Disable Helmet's default CSP handling
}));


// Initialize Firebase Admin SDK only once
const defaultApp = admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

// Initialize the second Firebase app
const secondApp = admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID2,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL2,
        privateKey: process.env.FIREBASE_PRIVATE_KEY2.replace(/\\n/g, '\n')
    }),
}, "secondApp"); // Provide a unique name

const fcm = defaultApp.messaging(); // Initialize FCM

// Firebase injection middleware
app.use((req, res, next) => {
    console.log("req.ip : " + req.ip);
    req.database = defaultApp.database();
    req.fcm = fcm;
    req.firestore = defaultApp.firestore();
    req.firestore2 = secondApp.firestore();
    req.Timestamp = defaultApp.firestore.Timestamp;
    req.Timestamp2 = secondApp.firestore.Timestamp;
    req.auth = defaultApp.auth();
    next();
});

const { sessionMiddleware, accessTokenVerification  } = require('./middlewares/authenticateMiddleWares');

//session store in server
app.use(sessionMiddleware);
app.use(accessTokenVerification);



// Import route modules
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const itemsRoutes = require('./routes/items');
const itemRoutes = require('./routes/item');
const cartRoutes = require('./routes/cart');
const adminRoutes = require('./routes/admin/admin');
const orderFormRoutes = require('./routes/orderForm');
const complaintRoutes = require('./routes/complaint');
const feedbackRoutes = require('./routes/feedback');
const profileRoutes = require('./routes/profile');
const trackRoutes = require('./routes/track');
const ordersRoutes = require('./routes/orders');
const viewDetailsRoutes = require('./routes/viewDetails');
const dashboardRoutes = require('./routes/admin/adminDashboard');
const adminOrdersRoutes = require('./routes/admin/adminOrders.js');
const adminCFRoutes = require('./routes/admin/adminComplaint&Feedback.js');
const adminUsersRoutes = require('./routes/admin/adminUsers.js');
const adminAddItemRoutes = require('./routes/admin/adminAddItem');
const adminModifyItemRoutes = require('./routes/admin/adminModifyItem');
const adminDeleteItemRoutes = require('./routes/admin/adminDeleteItem');
const adminApimRoutes = require('./routes/admin/adminApi.js');
const aboutUsRoutes = require('./routes/content');
const apiRoutes = require('./routes/api.js');
const searchRoutes = require('./routes/search.js');


// Use route modules
app.use('/auth', authRoutes);
app.use('/', indexRoutes);
app.use('/items', itemsRoutes);
app.use('/item', itemRoutes);
app.use('/cart', cartRoutes);
app.use('/orderForm', orderFormRoutes);
app.use('/complaint', complaintRoutes);
app.use('/feedback', feedbackRoutes);
app.use('/profile', profileRoutes);
app.use('/track', trackRoutes);
app.use('/orders', ordersRoutes);
app.use('/order-details', viewDetailsRoutes);
app.use('/admin983', adminRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/dashboard/orders', adminOrdersRoutes);
app.use('/dashboard/cf', adminCFRoutes);
app.use('/dashboard/users', adminUsersRoutes);
app.use('/dashboard/addItem', adminAddItemRoutes);
app.use('/dashboard/modifyItem', adminModifyItemRoutes);
app.use('/dashboard/deleteItem', adminDeleteItemRoutes);
app.use('/dashboard/api', adminApimRoutes);
app.use('/c', aboutUsRoutes);
app.use('/api', apiRoutes);
app.use('/search', searchRoutes);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// app.use(express.static('public'));
app.use('/public', express.static('public')); // Serve the 'public' directory as static
app.use(express.static(__dirname));  // to ensure root-level files like firebase-messaging-sw.js are accessible

app.use((req, res, next) => {
    return res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});


//for real time update a_meta
const metaRef = secondApp.firestore().collection("a_meta").doc("ordersData");

metaRef.onSnapshot((metaSnapshot) => {
    if (metaSnapshot.exists) {
        const metaData = metaSnapshot.data();
        console.log("🔥 Live Update:", metaData);

        // Send real-time data to frontend using WebSockets
        io.emit("updateMetaData", metaData);
    } else {
        console.log("❌ Document does not exist!");
    }
});

//for real time update a_meta
const latlngRef = secondApp.firestore().collection("latlng").doc("deliveryboy");

latlngRef.onSnapshot((metaSnapshot) => {
    if (metaSnapshot.exists) {
        const metaData = metaSnapshot.data();
        console.log("🔥 Live Update latlng:", metaData);

        // Send real-time data to frontend using WebSockets
        io.emit("updatelatlng", metaData);
    } else {
        console.log("❌ Document does not exist!");
    }
});

//for real time update order
// const ordersRef = secondApp.firestore().collection("order");

// ordersRef.onSnapshot((snapshot) => {
//     snapshot.docChanges().forEach((change) => {
//         const orderData = change.doc.data();

//         // Case 1: New Order Added
//         if (change.type === "added") {
//             console.log("🆕 New Order Added:", orderData);
//             io.emit("newOrder", orderData);
//         }

//         // Case 2: Order Status Changed to "cancelled" by User
//         if (change.type === "modified") {
//             const previousData = change.doc._document.data.value.mapValue.fields; // Gets previous snapshot
//             const prevStatus = previousData?.orderStatus?.stringValue; // Extract previous status

//             if (prevStatus !== "cancelled" && orderData.orderStatus === "cancelled" && orderData.whoCancelled === "user") {
//                 console.log("🚨 Order Cancelled by User:", orderData);
//                 io.emit("userCancelledOrder", orderData);
//             }
//         }
//     });
// });


// WebSockets for Frontend
io.on("connection", (socket) => {
    console.log("Client connected");

    // Send periodic keep-alive messages
    setInterval(() => {
        socket.emit("ping", { message: "keep-alive" });
    }, 10000); // Every 30 sec

    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });
});

app.get('/sitemap.xml', (req, res) => {
    res.sendFile(__dirname + '/public/sitemap.xml');
});


const PORT = process.env.PORT || 8080 || 10000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

