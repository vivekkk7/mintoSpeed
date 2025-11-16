async function getLocationAddress() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by this browser.");
        return { msg: "Geolocation is not supported. Write Address manually.", status: false };
    }

    // Check if permission was previously denied
    const permissionStatus = await navigator.permissions.query({ name: "geolocation" });

    if (permissionStatus.state === "denied") {
        alert("You have denied location access. Please enable it in browser settings.");
        return { msg: "Location permission denied. Enable it in settings.", status: false };
    }

    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                let lat = position.coords.latitude;
                let lon = position.coords.longitude;

                try {
                    let response = await fetch("/api/get-address", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ latitude: lat, longitude: lon }),
                    });

                    let data = await response.json();
                    resolve({ msg: data, lat, lon, status: true });

                } catch (error) {
                    resolve({ msg: "Something went wrong while fetching address. Try again or enter manually.", status: false });
                }
            },
            async (error) => {
                console.error("Error getting location:", error);

                if (error.code === error.PERMISSION_DENIED) {
                    alert("Location access is required. Please allow it in browser settings.");
                    // Re-check permission status
                    const newStatus = await navigator.permissions.query({ name: "geolocation" });
                    if (newStatus.state === "prompt") {
                        getLocationAddress(); // Try again
                    } else {
                        resolve({ msg: "Location access denied. Please enter address manually.", status: false });
                    }
                } else {
                    resolve({ msg: "Location unavailable. Please enter address manually.", status: false });
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0,
            }
        );
    });
}
