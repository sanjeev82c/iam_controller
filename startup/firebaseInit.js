/* Firebase */
const admin = require('firebase-admin');
var config = require('../appConfig');
var serviceAccount = require("../firebase.json");


module.exports = () => {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: config.get("databaseURL")
    });
   
}
