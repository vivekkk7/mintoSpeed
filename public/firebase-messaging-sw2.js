importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
    apiKey: "AIzaSyDFgvcbxCbPKwSxkzdIBYe0CJGCeqhQO2Q",
    authDomain: "mintospeed-web.firebaseapp.com",
    projectId: "mintospeed-web",
    storageBucket: "mintospeed-web.firebasestorage.app",
    messagingSenderId: "494958498311",
    appId: "1:494958498311:web:da56215a676c72ec7390a2"
});

const messaging = firebase.messaging();


// self.addEventListener('install', (event) => {
//     self.skipWaiting();
// });
  
//   self.addEventListener('activate', (event) => {
//     event.waitUntil(self.clients.claim());
//   });
 
// messaging.onBackgroundMessage((payload) => {
//     console.log("Received background message", payload);
    
//     self.registration.showNotification(payload.notification.title, {
//         body: payload.notification.body,
//         icon: "https://firebasestorage.googleapis.com/v0/b/mintospeed-web.firebasestorage.app/o/FCMImages%2Fweb-app-manifest-192x192.png?alt=media&token=63b628fa-834a-4126-977c-d179294324de",
//         // data: payload.data, // Pass order details
//     });
// });

// Handle background push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const payload = event.data.json();
    const title = payload.notification.title || 'New Notification';
    const options = {
      body: payload.notification.body,
      icon: "https://firebasestorage.googleapis.com/v0/b/mintospeed-web.firebasestorage.app/o/FCMImages%2Fweb-app-manifest-192x192.png?alt=media&token=63b628fa-834a-4126-977c-d179294324de",
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Handle notification clicks (e.g., navigate to a URL)
  event.waitUntil(clients.openWindow('/'));
});
