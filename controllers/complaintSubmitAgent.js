// npm install nodemailer

const nodemailer = require('nodemailer');

async function complaintSubmit(complaintData, email, complaintId, currentDateTimeString, retryCount = 2, delayBetweenRetries = 2000) {
  async function send() {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.INFO_EMAIL,
        pass: process.env.INFO_EMAIL_PASS
      }
    });

    let userId = '';
    if(complaintData.userId){
        userId = complaintData.userId
    }


// Final mail options with dynamic rows and subtotal
const mailOptions = {
  from: process.env.INFO_EMAIL,
  to: process.env.ADMIN_EMAIL,
  subject: 'Complaint received from customer',
  html: `
      <h3 style="text-transform: capitalize;">${complaintData.reason}</h3>
      <p>Complaint ID: ${complaintId} </p>
      <p>Details: ${complaintData.detail} </p> 
      <p>User email: ${email} </p>
      <p>UserId: ${userId} </p>
      <p>Complaint time: ${currentDateTimeString} </p> 

      <p>
          View complaint details: 
          <a href="https://www.mintospeed.in/dashboard/cf/complaint?id=${complaintId}">https://www.mintospeed.in/dashboard/cf/complaint?id=${complaintId}</a>
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
          await complaintSubmit(complaintData, email, complaintId, currentDateTimeString, retryCount - 1, delayBetweenRetries = 2000);
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
    complaintSubmit : complaintSubmit,
};
