// import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js';
// import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging.js';

// // Firebase configuration
// const firebaseConfig = {
//     apiKey: "AIzaSyDFgvcbxCbPKwSxkzdIBYe0CJGCeqhQO2Q",
//     authDomain: "mintospeed-web.firebaseapp.com",
//     projectId: "mintospeed-web",
//     storageBucket: "mintospeed-web.firebasestorage.app",
//     messagingSenderId: "494958498311",
//     appId: "1:494958498311:web:da56215a676c72ec7390a2",
//     measurementId: "G-G0671NCF1W"
//   };
// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const messaging = getMessaging(app);


// // Register the service worker for Firebase Messaging
// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' })
//     .then((registration) => {
//       console.log('Service Worker registered successfully:', registration);
//     })
//     .catch((error) => {
//       console.error('Service Worker registration failed:', error);
//     });
// }

// // Request notification permissions and get the token
// Notification.requestPermission().then((permission) => {
//   if (permission === 'granted') {
//     getToken(messaging, { vapidKey: "BJpQbXQuCD7lJZEXYxu4VxJtm1b7X3CAt2oTAtSC2g3kR0-bqHb2kFz0h8OiXHDD35XFkW-ZC3aPiePe4cGhqpQ" })
//             .then(token => {
//                 console.log("FCM Token:", token);
//                 // Send the token to your server
//                 fetch('/api/save-token', {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json'
//                     },
//                     body: JSON.stringify({ token: token })
//                 })
                    
//                     .then(response => {
//                         showAlert('Token  saved.', 'positive');

//                     })
//                     .catch(error => {
//                         console.error('Error submitting orderId:', error);
//                         showAlert('Failed to save token.', 'negative');
//                         return;
//                     });
//             })
//       .catch((err) => {
//         showAlert('Failed to get token.', 'negative');

//         console.log('An error occurred while retrieving token. ', err);
//       });
//   } else {
//     console.log('Unable to get permission to notify.');
//   }
// });

// // Handle incoming messages
// onMessage(messaging, (payload) => {
//   console.log('Message received. ', payload);
//   // Customize notification here
//   const notificationTitle = payload.notification.title;
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: '/public/favicon/web-app-manifest-192x192.png' // Update with your app's icon
//   };

//   new Notification(notificationTitle, notificationOptions);
// });