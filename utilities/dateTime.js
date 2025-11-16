const { parse } = require('date-fns');

// Function to get the current date in DD-MM-YYYY format
function getCurrentDate() {
    const date = new Date();
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
}

// Function to get the current time in HH:MM:SS format
function getCurrentTime() {
    const date = new Date();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}


//get currect ist time
function getCurrentISTTime() {
    return new Date();
}



//"2024-11-24T23:21" to "24/11/2024, 11:21:00 pm"
function formatDateTime(dateTimeString) {
    // Create a new Date object
    const date = new Date(dateTimeString);

    // Format date components
    const day = String(date.getDate()).padStart(2, '0'); // Day of the month (2 digits)
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month (0-indexed, so +1)
    const year = date.getFullYear(); // Full year

    // Format time components
    let hours = date.getHours(); // Hours in 24-hour format
    const minutes = String(date.getMinutes()).padStart(2, '0'); // Minutes (2 digits)
    const seconds = String(date.getSeconds()).padStart(2, '0'); // Seconds (2 digits)

    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12; // Convert to 12-hour format and handle midnight (0 -> 12)

    return `${day}/${month}/${year}, ${hours}:${minutes}:${seconds} ${ampm}`;
}

//convert firestore timestramp into string
function timestampIntoString(timestamp) {
    if (!timestamp || typeof timestamp.toDate !== 'function') {
        return "";
    }

    const date = timestamp.toDate(); // Firestore stores in UTC

    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata', // Convert UTC to IST correctly
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
    }).format(date);
}

function dateTimeForRealTimeDatabase(now) {
    const indiaDateTime = now.toLocaleString("en-GB", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true, // Use 12-hour format to include AM/PM
    });

    console.log(indiaDateTime); // Example: "16/11/2024, 06:30:00 PM"
    return indiaDateTime;
}


//sort data according to newest first
function sortDateTimeForRealTimeDatabase(date) {
    const format = "dd/MM/yyyy, hh:mm:ss a"; // 'a' for AM/PM

    // Preprocess function to convert "00" to "12" for AM/PM times
    function preprocessTime(orderTime) {
        return orderTime.replace(/, 00:/, ", 12:"); // Replace '00:' with '12:'
    }

    date.sort((a, b) => {
        const timeA = preprocessTime(a.orderTime);
        const timeB = preprocessTime(b.orderTime);

        const dateA = parse(timeA, format, new Date());
        const dateB = parse(timeB, format, new Date());

        if (isNaN(dateA) || isNaN(dateB)) {
            console.error("Invalid date parsing for:", timeA, timeB);
            return 0; // Keep original order if parsing fails
        }

        return dateB - dateA; // Sort in descending order (newest first)
    });
}

function differenceInTimeBoolean(inputTime, howMuch, currentTime) {
    console.log(inputTime);
    console.log(typeof inputTime);
    function parseCustomDateFormat(dateStr) {
        const regex = /(\d{1,2}) (\w+) (\d{4}) at (\d{2}):(\d{2}):(\d{2}) UTC([+-]\d{1,2}):(\d{2})/;
        const matches = dateStr.match(regex);

        if (!matches) {
            throw new Error("Invalid date format");
        }

        const day = parseInt(matches[1], 10);
        const monthStr = matches[2];
        const year = parseInt(matches[3], 10);
        const hours = parseInt(matches[4], 10);
        const minutes = parseInt(matches[5], 10);
        const seconds = parseInt(matches[6], 10);
        const offsetHours = parseInt(matches[7], 10);
        const offsetMinutes = parseInt(matches[8], 10);

        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const month = months.indexOf(monthStr);

        const isoDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}+${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;
        return new Date(isoDateStr);
    }

    if (inputTime.toDate) {
        inputTime = inputTime.toDate();
    }

    if (typeof inputTime === 'string') {
        inputTime = parseCustomDateFormat(inputTime);
    }

    if (!(inputTime instanceof Date) || isNaN(inputTime)) {
        throw new Error("Invalid inputTime");
    }

    const timeDifference = currentTime - inputTime;
    const isUnderMinutes = timeDifference <= howMuch && timeDifference >= 0;

    console.log(`Input time: ${inputTime}`);
    console.log(`Current time: ${currentTime}`);
    console.log(`Time difference: ${timeDifference / 1000} seconds`);

    return { isUnderMinutes, inputTime };
}



// Export all functions
module.exports = {
    getCurrentDate,
    getCurrentTime,
    getCurrentISTTime,
    formatDateTime,
    timestampIntoString,
    dateTimeForRealTimeDatabase,
    sortDateTimeForRealTimeDatabase,
    differenceInTimeBoolean
};