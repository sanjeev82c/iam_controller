const admin = require('firebase-admin');
//const { errorOuput } = require('../models/sample_model_3');

//  async function verifyIdToken(req, res, next) {
//     let idToken = req.headers.authorization;

//     if (!idToken) {
//         return res.status(400).json(errorOuput(req.t("error.auth_failed")));
//     }
//     try {
//         idToken = idToken.replace("Bearer ", "");
//         const decodedIdToken = await admin.auth().verifyIdToken(idToken);
//         // console.log(decodedIdToken);
//         req.user = decodedIdToken;
//         // res.send(req.user);
//         return next();
//     } catch (e) {
//         console.log(e);
//         return res.status(400).json(errorOuput(req.t("error.auth_failed")));
//     }
// }

async function verifyIdToken(req, res, next) {
  return next();
}

module.exports = verifyIdToken;
