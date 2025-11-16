async function getDeliveryBoyLatLng() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return { msg: "Geolocation is not supported. Write Address manually.", status: false };
    }

    console.log("Getting location...");

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                let lat = position.coords.latitude;
                let lon = position.coords.longitude;
                console.log("Coordinates:", lat, lon);

                try {
                    let response = await fetch("/dashboard/api/addlatlngofDeliveryBoy", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ latitude: lat, longitude: lon }),
                    });

                    let data = await response.json();
                    resolve({ status: true });

                } catch (error) {
                    resolve({ msg: "Something went wrong while fetching address. Try again or enter manually.", status: false });
                }
            },
            (error) => {
                console.error("Error getting location:", error);
                resolve({ msg: "Location access denied or unavailable. Please enter address manually.", status: false });
            },
            {
                enableHighAccuracy: true,
                timeout: 5000, // Increased timeout
                maximumAge: 0,
            }
        );
    });
}
getDeliveryBoyLatLng();

setInterval(() => {
    getDeliveryBoyLatLng();
}, 30000);
