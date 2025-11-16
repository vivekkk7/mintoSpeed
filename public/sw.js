// Service Worker (sw.js)

importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js");
importScripts("https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js");

// Initialize Firebase inside Service Worker
const firebaseConfig = {
    apiKey: "AIzaSyDFgvcbxCbPKwSxkzdIBYe0CJGCeqhQO2Q",
    authDomain: "mintospeed-web.firebaseapp.com",
    projectId: "mintospeed-web",
    storageBucket: "mintospeed-web.firebasestorage.app",
    messagingSenderId: "494958498311",
    appId: "1:494958498311:web:da56215a676c72ec7390a2"
};
firebase.initializeApp(firebaseConfig);

// Background Sync Event
self.addEventListener('sync', (event) => {
    if (event.tag === 'location-update') {
        event.waitUntil(updateLocation());
    }
});

// Function to get current location and update Firebase
async function updateLocation() {
    return new Promise((resolve, reject) => {
        self.registration.showNotification("Updating location...");
        
        self.navigator.geolocation.getCurrentPosition((position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            firebase.database().ref('deliveryBoy/location').set({
                lat: lat,
                lng: lng,
                timestamp: Date.now()
            }).then(() => {
                console.log("Location updated in Firebase");
                resolve();
            }).catch((error) => {
                console.error("Error updating location:", error);
                reject(error);
            });
        }, (error) => {
            console.error("Geolocation error:", error);
            reject(error);
        });
    });
}
