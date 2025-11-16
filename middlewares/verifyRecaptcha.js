const axios = require('axios');

module.exports = async (req, res, next) => {
    
    const token = req.body.token;
    if(!token){
        req.reCaptcha = false;
        next();
        return;
    }

    try {
        // Verify the token with Google's API
        const response = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify`,
            null,
            {
                params: {
                    secret: process.env.RECAPTCHA_SITE_KEY,
                    response: token,
                },
            }
        );

        const { success, score } = response.data;

        if (success && score > 0.5) {
            console.log("score : " + score);
            req.reCaptcha = true;
            req.captchaScore = score;
            console.log("recaptacha verified.");
            return next();
        } else {
            req.reCaptcha = false;
            next();
            return;        
        }
    } catch (error) {
        console.error(error);
        req.reCaptcha = false;
        next();
        return;    
    }
   
};


// const { RecaptchaEnterpriseServiceClient } = require('@google-cloud/recaptcha-enterprise');

// module.exports = async (req, res, next) => {
//     const token = req.body.token;
//     if(!token){
//         return res.json({ message: 'Recaptcha not found. Please try again.', type: 'negative' });
//     }

//     const params = {
//         projectID: 'mintospeed',        
//         recaptchaKey: '6LfpL6MqAAAAADXXbESyGRXDNwTJdsZCuqO3ffIr', 
//         token: token,      // Replace with the token generated from reCAPTCHA verification
//         recaptchaAction: 'LOGIN' // Replace with the action name (e.g., 'login' or 'signup')
//       };

//     await createAssessment(params);

//     async function createAssessment({
//         projectID,
//         recaptchaKey,
//         token,
//         recaptchaAction ,
//     }) {

//         const client = new RecaptchaEnterpriseServiceClient();
//         const projectPath = client.projectPath(projectID);

//         // Build the assessment request.
//         const request = ({
//             assessment: {
//                 event: {
//                     token: token,
//                     siteKey: recaptchaKey,
//                 },
//             },
//             parent: projectPath,
//         });

//         try {
//             const [response] = await client.createAssessment(request);

//             // Check if the token is valid.
//             if (!response.tokenProperties.valid) {
//                 console.log(`The CreateAssessment call failed because the token was: ${response.tokenProperties.invalidReason}`);
//                 return res.json({ message: 'Recaptcha failed. Please try again.', type: 'negative' });
//             }

//             if (response.tokenProperties.action === recaptchaAction) {
//                 console.log(`The reCAPTCHA score is: ${response.riskAnalysis.score}`);
//                 response.riskAnalysis.reasons.forEach((reason) => {
//                     console.log(reason);
//                 });

//                 const score = response.riskAnalysis.score;

//                 if (score === null || score < 0.5) {
//                     return res.json({ message: 'Recaptcha failed. Try again.', type: 'negative' });
//                 }
//                 req.captchaScore = score;
//                 return next();
//             } else {
//                 console.log("The action attribute in your reCAPTCHA tag does not match the action you are expecting to score");
//                 return res.json({ message: 'Invalid Recaptcha. Refresh page and try again.', type: 'negative' });
//             }
//         }
//         catch (err) {
//             return res.json({ message: 'Something went wrong with reCaptcha. Try again.' + err, type: 'negative' });
//         }
//     }
// };