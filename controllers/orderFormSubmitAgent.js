// npm install nodemailer

const nodemailer = require('nodemailer');

async function orderFormSubmit(orderItems, orderData, orderId, errorForAdmin, logsForAdmin, currentDateTimeString, retryCount = 2, delayBetweenRetries = 2000) {
  async function send() {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.INFO_EMAIL,
        pass: process.env.INFO_EMAIL_PASS
      }
    });


let rows = '';
let errorForAdminVal = '';
if(errorForAdmin.length > 0){
  errorForAdminVal += "Error : ";
  for(let i = 0; i < errorForAdmin.length; i++){
    errorForAdminVal += `<p style="margin: 5px; font-size: 13px; color: red;">${errorForAdmin[i]}</p>`;
  }
}
console.log("errorForAdmin  : " + errorForAdminVal);
let logsForAdminVal = '';
if(logsForAdmin.length > 0){
  logsForAdminVal += "Logs : ";
  for(let i = 0; i < logsForAdmin.length; i++){
    logsForAdminVal += `<p style="margin: 5px; font-size: 13px; color: black;">${logsForAdmin[i]}</p>`;
  }
}
console.log("logsForAdmin  : " + logsForAdminVal);


orderItems.forEach((orderItems) => {
  rows += `
      <tr>
          <td style="border: 1px solid #ccc; padding: 8px; text-align: center;">${orderItems.img ? `<img style="height: 50px;" src="${orderItems.img}" alt="content image" />` : ''}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${orderItems.name}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">${orderItems.quantity}</td>
          <td style="border: 1px solid #ccc; padding: 8px;">₹${orderItems.price}</td>
      </tr>
  `;
});

// Final mail options with dynamic rows and subtotal
const mailOptions = {
  from: process.env.INFO_EMAIL,
  to: process.env.ADMIN_EMAIL,
  subject: 'Someone request an order',
  html: `
      <h3>Order details are:</h3> 
      ${errorForAdminVal}
      ${logsForAdminVal}
      <p>Order ID: ${orderId} </p>
     <p>Name: ${orderData.fullName}</p>
     <p>Mobile: ${orderData.phone}</p>
     <p>Email: ${orderData.email}</p>
     <p>UserId: ${orderData.orderUserId}</p>
     <p>Address: ${orderData.streetAddress + " " + orderData.city + " " + orderData.pincode}</p>
     <p>Order on: ${currentDateTimeString}</p>
      
      <h4>Order Items</h4>
      <table style="width: 100%; border-collapse: collapse;">
          <thead>
              <tr>
                  <th style="border: 1px solid #ccc; padding: 8px;">Img</th>
                  <th style="border: 1px solid #ccc; padding: 8px;">Item Name</th>
                  <th style="border: 1px solid #ccc; padding: 8px;">Qty</th>
                  <th style="border: 1px solid #ccc; padding: 8px;">Price</th>
              </tr>
          </thead>
          <tbody>
              ${rows}
          </tbody>
          <tfoot>
              <tr>
                  <td colspan="3" style="border: 1px solid #ccc; padding: 8px; text-align: right;">Subtotal</td>
                  <td style="border: 1px solid #ccc; padding: 8px;">₹${orderData.orderTotalPrice} <br />(${orderData.orderTotalItems}&nbsp;items)</td>
              </tr>
          </tfoot>
      </table>

      <p>
          View order details: 
          <a href="https://www.mintospeed.in/dashboard/orders/lifetime?orderId=${orderId}">https://www.mintospeed.in/dashboard/orders/lifetime?orderId=${orderId}</a>
      </p>
      <h4>From mintoSpeed</h4>
  `
};


    try {
      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.response);
      
    } catch (error) {
      console.log(error);

      if (retryCount > 0) {
        console.log(`Retrying in ${delayBetweenRetries / 1000} seconds...`);
        setTimeout(async () => {
          await orderFormSubmit(orderItems, orderData, orderId, errorForAdmin, logsForAdmin, currentDateTimeString, retryCount - 1, delayBetweenRetries = 2000);
        }, delayBetweenRetries);
      } else {
        console.log('Maximum retry count reached. Email not sent.');
        return false;
      }
    }
  }

  await send();
}

module.exports = {
    orderFormSubmit : orderFormSubmit,
};
