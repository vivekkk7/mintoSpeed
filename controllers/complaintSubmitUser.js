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


// Final mail options with dynamic rows and subtotal
const mailOptions = {
  from: process.env.INFO_EMAIL,
  to: email,
  subject: 'Complaint received!',
  html: `
      <h3>Complaint received!</h3>
      <p>We received your complaint for ${complaintData.reason}. Kindly wait, we will proceed your complaint soon.</p>
      <p>Complaint ID: ${complaintId} </p>
      <p>Complaint time: ${currentDateTimeString} </p>
     <br />
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
