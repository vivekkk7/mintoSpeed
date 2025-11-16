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
    timestamp =  timestamp.toString(36)  // Convert current timestamp to base36
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
  
  