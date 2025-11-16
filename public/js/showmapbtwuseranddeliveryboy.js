const modal2 = document.getElementById("messageBoxid02");
const messageBoxHead2 = document.getElementById("messageBoxHead2");
const messageBoxP2 = document.getElementById("messageBoxP2");
const actionButton2 = document.getElementById("actionButton2");

let map;
let userMarker, deliveryMarker;
let userLocation = { lat: 25.434612, lng: 81.894528 }; 
let deliveryLocation;
let directionsService, directionsRenderer;


document.addEventListener("DOMContentLoaded", () => {

    function initMap() {
        const mapElement = document.getElementById("map");
        if (!mapElement) {
            console.error("Map container not found!");
            return;
        }

        map = new google.maps.Map(mapElement, {
            center: userLocation,
            zoom: 15,
            mapId: "45d93d59f8e4f8ce",
        });

        // Initialize Google Maps Directions Service
        directionsService = new google.maps.DirectionsService();
        directionsRenderer = new google.maps.DirectionsRenderer({
            map: map,
            suppressMarkers: true, // Hide default markers
        });

        const { AdvancedMarkerElement } = google.maps.marker;

        // User's Location Marker
        userMarker = new AdvancedMarkerElement({
            map,
            position: userLocation,
            title: "User Location",
        });

        map.setCenter(userLocation);

        
        updateDeliveryLocation();
        setInterval(updateDeliveryLocation, 30000); // Update every 30 seconds
    }

    function updateDeliveryLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    let latitude = position.coords.latitude;
                    let longitude = position.coords.longitude;
                    addDeliveryLocation(latitude, longitude);
                },
                (error) => {
                    console.error("Error getting location:", error);
                }
            );
        } else {
            console.error("Geolocation is not supported by this browser.");
        }
    }

    function addDeliveryLocation(latitude, longitude) {
        deliveryLocation = { lat: latitude, lng: longitude };

        const { AdvancedMarkerElement } = google.maps.marker;

        const deliveryWrapper = document.createElement("div");
        deliveryWrapper.style.width = "50px";
        deliveryWrapper.style.height = "50px";

        const deliveryIcon = document.createElement("img");
        deliveryIcon.src =
            "https://firebasestorage.googleapis.com/v0/b/mintospeed-web.firebasestorage.app/o/FCMImages%2Fmslocation.png?alt=media&token=d83bb8e0-96bb-432b-a8c2-67332b2eed94";
        deliveryIcon.style.width = "100%";
        deliveryIcon.style.height = "100%";

        deliveryWrapper.appendChild(deliveryIcon);

        if (deliveryMarker) {
            deliveryMarker.setMap(null); // Remove previous marker
        }

        deliveryMarker = new AdvancedMarkerElement({
            map: map,
            position: deliveryLocation,
            title: "Delivery Boy",
            content: deliveryWrapper,
        });

        showDirections();
        calculateDistance();

    }

    // 📌 Show Road Directions from User to Delivery Boy
    function showDirections() {
        if (!deliveryLocation) return;

        const request = {
            origin: userLocation,
            destination: deliveryLocation,
            travelMode: google.maps.TravelMode.DRIVING,
        };

        directionsService.route(request, (result, status) => {
            if (status === "OK") {
                directionsRenderer.setDirections(result);

                // 📌 Get Estimated Time
                const arriveTimeElement = document.getElementById("arriveTime");
                if (arriveTimeElement) {
                    const duration = result.routes[0].legs[0].duration.text;
                    arriveTimeElement.textContent = `Arrive in : ${duration}`;
                }
            } else {
                console.error("Error fetching directions:", status);
            }
        });
    }

    function calculateDistance() {
        if (userLocation && deliveryLocation) {
            const distance = haversineDistance(userLocation, deliveryLocation);
            distanceDisplay = document.getElementById("distanceMap");
            distanceDisplay.innerHTML = `User is ${distance.toFixed(2)} km away`;
        }
    }

    // 📌 Haversine Formula to Calculate Distance
    function haversineDistance(coord1, coord2) {
        const R = 6371; // Radius of Earth in km
        const dLat = toRad(coord2.lat - coord1.lat);
        const dLng = toRad(coord2.lng - coord1.lng);
        const lat1 = toRad(coord1.lat);
        const lat2 = toRad(coord2.lat);

        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in km
    }

    function toRad(deg) {
        return deg * (Math.PI / 180);
    }



    // Attach event listeners to all buttons dynamically
    document.querySelectorAll(".showmapbtn").forEach((button) => {
        if (!button.hasAttribute("data-listener")) {
            button.setAttribute("data-listener", "true");
            button.addEventListener("click", () => {
                const lat = button.getAttribute("data-lat");
                const lng = button.getAttribute("data-lng");
                const orderId = button.getAttribute("data-order-id");
                const name = button.getAttribute("data-name");
                openPopup2(lat, lng, orderId, name);
            });
        }
    });

    // Ensure action button closes the modal
    if (actionButton2) {
        actionButton2.onclick = function () {
            modal2.style.display = "none";
        };
    } else {
        console.error("Action button not found!");
    }

    window.onload = initMap;
});

function openPopup2(lat, lng, orderId, name) {
    messageBoxHead2.textContent = `${name}'s Location`;
    messageBoxP2.textContent = `Order ID: ${orderId}`;

    modal2.style.display = "flex";

    userLocation = { lat: parseFloat(lat), lng: parseFloat(lng) };
    if (userMarker) {
        // Update existing marker position
        userMarker.position = userLocation;
        map.setCenter(userLocation); // Move map center to new user location
    } else {
        console.error("User marker not found!");
    }
}
