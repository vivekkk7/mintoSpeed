const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const authenticateAdmin = require('../middlewares/authenticateAdmin');

// router.post('/search', async (req, res) => {
//     let query = req.body.query;
//     if (!query || query.trim() === '') {
//         return res.status(400).json({ error: 'Query is required.' });
//     }
//     query = query.toLowerCase();

//     try {
//         const snapshot = await req.firestore.collection('searchIndex')
//             .where(admin.firestore.FieldPath.documentId(), '>=', query)
//             .where(admin.firestore.FieldPath.documentId(), '<=', query + '\uf8ff')
//             .get();

//         if (snapshot.empty) {
//             return res.json([]);
//         }

//         const results = snapshot.docs.map(doc => {
//             const data = doc.data();
//             return {
//                 id: doc.id,
//                 t: data.t,
//                 cat: data.cat || null,
//                 subcat: data.subcat || null,
//             };
//         });

//         return res.json(results);
//     } catch (error) {
//         console.error('Error performing search:', error);
//         return res.status(500).json({ error: 'Internal Server Error' });
//     }
// });


//fetch cat or subcates


router.post('/fetchCategorOrSubcategories', async (req, res) => {
  const { t, cat } = req.body; // 't' is the type (cat, subcat), 'cat' is the category name
  try {
    let query = req.firestore.collection('catSubcatIndex').where('t', '==', t);

    if (t === 'subcat' && cat) {
      query = query.where('cat', '==', cat);
    }

    const snapshot = await query.get();
    const documents = [];

    snapshot.forEach((doc) => {
      documents.push(doc.id);
    });

    res.status(200).json({ documents });
  } catch (error) {
    console.error('Error fetching documents:', error);
    return res.status(500).send('Internal Server Error');
  }
});


//save token
router.post("/save-fcm-token", authenticateAdmin, async (req, res) => {
  if (!req.isAlphaToken) {
    return res.json({ message: 'Unauthorized access.', type: 'negative' });
  }
  const { token } = req.body;

  if (!token) {
    return res.status(400).send("User ID and FCM Token are required.");
  }

  try {
    await req.firestore.collection("deliveryBoys").doc(userId).set(
      { token },
      { merge: true }
    );

    return res.json({ message: '', type: 'positive' });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    return res.json({ message: error, type: 'negative' });
  }
});


//
router.post("/get-address", async (req, res) => {
  console.log("testi 1");
  const { latitude, longitude } = req.body;
  if (!latitude || !longitude) {
    return res.status(400).json({ error: "Invalid coordinates" });
  }

  function isValidLatitude(lat) {
    return typeof lat === "number" && lat >= -90 && lat <= 90;
  }

  function isValidLongitude(lon) {
    return typeof lon === "number" && lon >= -180 && lon <= 180;
  }

  function isValidCoordinates(lat, lon) {
    return isValidLatitude(lat) && isValidLongitude(lon);
  }

  //lattitude and longitude
  if (!isValidCoordinates(latitude, longitude)) {
    return res.json({ error: "Failed to get address. Please write address manually." });
  }

  const API_KEY = process.env.GOOGLE_API_KEY;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${API_KEY}`
    );
    const data = await response.json();

    if (data.status === "OK") {
      let desiredAddress = null;

      // Iterate over all results
      for (let result of data.results) {
        // Check if any address component has the postal code "486226"
        const hasPostalCode = result.address_components.some(component =>
          component.types.includes("postal_code") && 
          (component.long_name === "211019" || component.long_name === "486226")
      );      

        if (hasPostalCode) {
          desiredAddress = result;
          break;
        }
      }

      if (desiredAddress) {
        const addressComponents = desiredAddress.address_components;
        const formatted_address = desiredAddress.formatted_address;
        console.log("formated address : " + desiredAddress.formatted_address);

        let street = "";
        let city = "";
        let district = "";
        let state = "";
        let country = "";
        let postalCode = "";

        // Extract individual components
        addressComponents.forEach((component) => {
          if (component.types.includes("route")) {
            street = component.long_name;  // Street name
          }
          if (component.types.includes("locality")) {
            city = component.long_name;  // City
          }
          if (component.types.includes("administrative_area_level_2")) {
            district = component.long_name;  // District
          }
          if (component.types.includes("administrative_area_level_1")) {
            state = component.long_name;  // State
          }
          if (component.types.includes("country")) {
            country = component.long_name;  // Country
          }
          if (component.types.includes("postal_code")) {
            postalCode = component.long_name;  // Postal code
          }
        });

        console.log(`Street: ${street}, City: ${city}, District: ${district}, State: ${state}, Country: ${country}, Postal Code: ${postalCode}`);

        return res.json({ status: true, address: formatted_address, city, district, state, country, postalCode });
      } else {
        return res.json({ error: "Currently, We accept 211019 pincode. If you are not from this area please wait, we will reach to your location soon." });
      }
    } else {
      return res.json({ error: "Failed to get address. Please write address manually." });
    }
  } catch (error) {
    console.log("testi 2");
    return res.status(500).json({ error: "Server error" });
  }
});


router.post("/getOrderStaus", async (req, res) => {
  const { orderId } = req.body;
  const userId = (req.isAccessToken && req.userId && req.isLogged) ? req.userId : null;
  if (!userId) {
    return res.redirect('/auth/login');
  }
  if (!orderId) {
    return res.json({ status: false});
  }
  let validateInput = (input) => typeof input === 'string' && /^[a-zA-Z0-9]+$/.test(input);
  if (!validateInput(orderId)) {
    return res.json({ status: false});
  }

  try {
    const orderDoc = await req.firestore2.collection('orderByUserId').doc(userId).collection('orders').doc(orderId).get();
    if (orderDoc.exists) {
      const orderData = orderDoc.data();
      if(orderData.status == "pending" && !orderData.deliveryTime){
        return res.json({ status: false});
      }
      else if(orderData.status == "pending" && orderData.deliveryTime){
        return res.json({ status: true});
      }
      else {
        return res.json({ status: false, type: "cancel"});
      }
      
    } else {
      return res.json({ status: false});
    }
  } catch (error) {
    return res.json({ status: false});
  }
});

module.exports = router;