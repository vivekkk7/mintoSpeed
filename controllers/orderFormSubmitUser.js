// npm install nodemailer

const nodemailer = require('nodemailer');

async function orderFormSubmit(orderItems, orderData, orderId, currentDateTimeString, retryCount = 2, delayBetweenRetries = 2000) {
  async function send() {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.INFO_EMAIL,
        pass: process.env.INFO_EMAIL_PASS
      }
    });


let rows = '';

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
  to: orderData.email,
  subject: 'Order Details',
  html: `
      <h3>Your order details are:</h3> 
      <p>Order ID: ${orderId} </p>
      
     <p>Name: ${orderData.fullName}</p>
     <p>Mobile: ${orderData.phone}</p>
     <p>Email: ${orderData.email}</p>
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
          See your order: 
          <a href="https://www.mintospeed.in/order-details?orderId=${encodeURIComponent(orderId)}">Click here</a>
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
          await orderFormSubmit(orderItems, orderData, orderId, currentDateTimeString, retryCount - 1, delayBetweenRetries = 2000);
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
