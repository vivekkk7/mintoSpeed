// npm install nodemailer

const nodemailer = require('nodemailer');

async function orderCancelledByUsertoAgent(cancelTime, userId, orderId, errorForAdmin, retryCount = 2, delayBetweenRetries = 2000) {
  async function send() {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.INFO_EMAIL,
        pass: process.env.INFO_EMAIL_PASS
      }
    });

    let errorForAdminVal = '';
    if(errorForAdmin.length > 0){
      errorForAdminVal += "Error : ";
      for(let i = 0; i < errorForAdmin.length; i++){
        errorForAdminVal += `<p style="margin: 5px; font-size: 13px; color: red;">${errorForAdmin[i]}</p>`;
      }
    }

// Final mail options with dynamic rows and subtotal
const mailOptions = {
  from: process.env.INFO_EMAIL,
  to: process.env.ADMIN_EMAIL,
  subject: 'Order cancelled by User',
  html: `
      <h3 style="color: red;">Order cancelled by user</h3>
      <p>Order ID: ${orderId} </p>
      <p>UserId: ${userId} </p>
      <p>Cancelled on: ${cancelTime} </p> 
      <br />
      <p style="color: red;">${errorForAdminVal}</p>
     
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
          await orderCancelledByUsertoAgent(cancelTime, userId, orderId, errorForAdmin, retryCount - 1, delayBetweenRetries = 2000);
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
    orderCancelledByUsertoAgent : orderCancelledByUsertoAgent,
};
