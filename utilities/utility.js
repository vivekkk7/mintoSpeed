// utility.js
const admin = require('firebase-admin');
const { getCurrentISTTime } = require('./dateTime');


// Utility to convert kg/gm to grams
function convertToGrams(value) {
    if (typeof value === 'string' && value.includes('kg')) {
        return parseFloat(value) * 1000;
    } else {
        return parseInt(value);
    }
}

// Utility function to convert a weight string to grams
function convertToGrams2(weightText) {
    const [amount, unit] = weightText.split(' ');
    let value = parseFloat(amount);
    if (unit.toLowerCase() === 'kg') {
        return value * 1000; // Convert kg to grams
    } else if (unit.toLowerCase() === 'gm' || unit.toLowerCase() === 'g') {
        return value; // Already in grams
    }
    return value;
}

function generateUniqueId(length) {
    // Ensures we have access to the crypto API
    if (typeof crypto === 'undefined' || !crypto.getRandomValues) {
        throw new Error("Crypto API not available");
    }

    // Characters to include in the ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';

    // Add a timestamp component to ensure time-based uniqueness
    let timestamp = Date.now();
    console.log("timestamp : " + timestamp);
    // const date = new Date(timestamp);
    // console.log("date : " + date.toString()); //to get real datetime
    timestamp = timestamp.toString(36)  // Convert current timestamp to base36
    id += timestamp;

    // Fill remaining length with random characters
    const randomLength = length - timestamp.length;
    console.log("randomLength : " + randomLength);

    const randomArray = new Uint8Array(randomLength);
    crypto.getRandomValues(randomArray);

    for (let i = 0; i < randomLength; i++) {
        id += chars[randomArray[i] % chars.length];
    }

    return id;
}

function getClosestWeightAndPrice(inputData, itemData) {

    let options = JSON.parse(itemData.options);

    if (itemData.packed === "false" || itemData.packed == false) {
        if (options.length === 0) {
            console.log("err 1");
            return { price: 0, message: "No options available" };
        }
        const minVol = convertToGrams2(itemData.min);
        const maxVol = convertToGrams2(itemData.max);
        console.log("getClosestWeightAndPrice");

        let selectedWeight = inputData;
        let targetWeight = convertToGrams2(selectedWeight); // Convert inputData like "1 kg" or "500 gm" to grams

        let closestWeight = null;
        let closestPrice = null;
        let closestDifference = Infinity;

        // Loop through all the weight and price options
        options.forEach(option => {
            let weight = convertToGrams2(option.weight); // Convert weight text like "100 gm" to a number in grams
            let price = parseFloat(option.price); // Get the corresponding price

            // Calculate the difference between the target weight and the current option weight
            let difference = Math.abs(targetWeight - weight);

            // If this is the closest weight so far, update the closest weight and price
            if (difference < closestDifference) {
                closestDifference = difference;
                closestWeight = weight; // Store the closest weight in grams
                closestPrice = price;   // Store the corresponding price
            }
        });

        let rate = closestPrice / closestWeight;
        let newPrice = (rate * targetWeight).toFixed(2);
        console.log("newPrice : " + newPrice);


        // Check if the target weight is within the allowed volume range
        if (targetWeight >= minVol && targetWeight <= maxVol) {
            return parseInt(newPrice);
        } else {
            return 0;
        }
    } else if (itemData.packed === "true" || itemData.packed == true) {
        const minVol = parseInt(itemData.min);
        const maxVol = parseInt(itemData.max);

        const itemQty = parseInt(itemData.qty); // Assuming quantity is provided in itemData
        const itemPriceforQty = parseFloat(itemData.price); // Assuming price is provided in itemData for packed items
        const rate = itemPriceforQty / itemQty;
        let newPrice = (rate * inputData).toFixed(2);
        console.log("newPrice : " + newPrice);


        if (inputData >= minVol && inputData <= maxVol) {
            return parseInt(newPrice);
        } else {
            return 0;
        }
    } else {
        return 0;
    }
}


//fetch items
async function fetchManyItems(query, limit = 0, startAfter = null) {
    let items = [];

    try {
        let firestoreQuery = query;
        if (startAfter) firestoreQuery = firestoreQuery.startAfter(startAfter);

        const itemsSnapshot = limit == 0 ? await firestoreQuery.get() : await firestoreQuery.limit(limit).get();

        items = itemsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                category: data.category,
                subcategory: data.subcategory,
                id: doc.id,
                volume: data.qty,
                price: data.price,
                stock: data.stock || 'x',
                minVol: data.min,
                maxVol: data.max,
                packed: data.packed,
                image_url: data.img,
                popularMRP: data.popularMRP && data.popularMRP.trim() !== '' ? '₹ ' + data.popularMRP : '',
                replaceSelect: data.replaceSelect || 'false',
                options: JSON.parse(data.options || '[]')
            };
        });

        return { items, lastVisible: itemsSnapshot.docs[itemsSnapshot.docs.length - 1] };
    }
    catch (err) {
        return { items, lastVisible: null };
    }

}


//getOrdersNum amin dasboard
async function getOrdersNum(db, type) {
    let today = 0, yesterday = 0, last_7_days = 0, this_month = 0, last_month = 0;
    const date = getCurrentISTTime();
    // Get current year, month, and day
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    // console.log("getOrdersNum date : " + date);
    // console.log("getOrdersNum year : " + year);
    // console.log("getOrdersNum month : " + month);
    // console.log("getOrdersNum day : " + day);

    // Get yesterday's date (creating a new instance of Date)
    let yesterdayDate = new Date(date);
    yesterdayDate.setDate(date.getDate() - 1);
    const yesterdayYear = yesterdayDate.getFullYear();
    const yesterdayMonth = String(yesterdayDate.getMonth() + 1).padStart(2, "0");
    const yesterdayDay = String(yesterdayDate.getDate()).padStart(2, "0");

    // console.log("getOrdersNum yesterdayDate : " + yesterdayDate);
    // console.log("getOrdersNum yesterdayYear : " + yesterdayYear);
    // console.log("getOrdersNum yesterdayMonth : " + yesterdayMonth);
    // console.log("getOrdersNum yesterdayDay : " + yesterdayDay);

    // Get last month details
    let lastMonthDate = new Date(date);
    lastMonthDate.setMonth(date.getMonth() - 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonth = String(lastMonthDate.getMonth() + 1).padStart(2, "0");
    const lastMonthDocId = `${lastMonthYear}-${lastMonth}`;

    const monthDocId = `${year}-${month}`;
    const yesterdayDocId = `${yesterdayYear}-${yesterdayMonth}`; // Document ID for yesterday's month

    // console.log("getOrdersNum lastMonthDate : " + lastMonthDate);
    // console.log("getOrdersNum lastMonthYear : " + lastMonthYear);
    // console.log("getOrdersNum lastMonth : " + lastMonth);
    // console.log("getOrdersNum lastMonthDocId : " + lastMonthDocId);
    // console.log("getOrdersNum monthDocId : " + monthDocId);
    // console.log("getOrdersNum yesterdayDocId : " + yesterdayDocId);

    // References to Firestore docs
    const monthRef = db.collection('a_meta').doc('ordersData').collection(type).doc(monthDocId);
    const lastMonthRef = db.collection('a_meta').doc('ordersData').collection(type).doc(lastMonthDocId);
    const yesterdayRef = db.collection('a_meta').doc('ordersData').collection(type).doc(yesterdayDocId);

    try {
        // Get current month data
        const doc = await monthRef.get();
        if (doc.exists) {
            const data = doc.data();
            today = data[day] || 0;
            this_month = data.this_month || 0;

            // Correct last_7_days calculation across months
            for (let i = 1; i <= 7; i++) {
                let pastDate = new Date(date); // Create a new date instance for each iteration
                pastDate.setDate(date.getDate() - i);
                let pastYear = pastDate.getFullYear();
                let pastMonth = String(pastDate.getMonth() + 1).padStart(2, "0");
                let pastDay = String(pastDate.getDate()).padStart(2, "0");

                // console.log("getOrdersNum pastDate : " + pastDate);
                // console.log("getOrdersNum pastYear : " + pastYear);
                // console.log("getOrdersNum pastMonth : " + pastMonth);
                // console.log("getOrdersNum pastDay : " + pastDay);

                if (pastDate.getMonth() !== date.getMonth()) {
                    // If past date is from last month, fetch from last month's doc
                    const pastMonthRef = db.collection('a_meta').doc('ordersData').collection(type).doc(`${pastYear}-${pastMonth}`);
                    const pastMonthDoc = await pastMonthRef.get();
                    if (pastMonthDoc.exists) {
                        const pastMonthData = pastMonthDoc.data();
                        last_7_days += pastMonthData[pastDay] || 0;
                    }
                } else {
                    last_7_days += data[pastDay] || 0;
                }
            }
        }

        // Get yesterday's data correctly
        if (day === "01") { // If today is the 1st of the month, fetch yesterday from last month's doc
            const yesterdayDoc = await yesterdayRef.get();
            if (yesterdayDoc.exists) {
                const yesterdayData = yesterdayDoc.data();
                yesterday = yesterdayData[yesterdayDay] || 0;
            }
        } else {
            yesterday = doc.exists && doc.data()[yesterdayDay] || 0;
        }

        // Get last month's total data
        const lastMonthDoc = await lastMonthRef.get();
        if (lastMonthDoc.exists) {
            const lastMonthData = lastMonthDoc.data();
            last_month = lastMonthData.this_month || 0;
        }

        return { today, yesterday, last_7_days, this_month, last_month };
    } catch (err) {
        console.error("Error fetching order numbers:", err);
        return { today, yesterday, last_7_days, this_month, last_month };
    }
}





// Export all functions
module.exports = {
    convertToGrams,
    generateUniqueId,
    convertToGrams2,
    getClosestWeightAndPrice,
    fetchManyItems,
    getOrdersNum
};
