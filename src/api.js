const winston = require('winston');
const express = require('express');
const serverless = require('serverless-http');
const app = express();

//require('../startup/lang')(app);
require('../startup/logging')();
require('../startup/firebaseInit')();
require('../startup/routes')(app);

/* Port */
const port = process.env.PORT || 5000;
const server = app.listen(port, () =>
  winston.info(`Listening on port ${port}...`)
);

/* module.exports = app;
module.exports.handler = serverless(app); */
