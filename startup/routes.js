const express = require('express');
const iamroute = require('../routes/IAMController');
const error = require('../middleware/error');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const fileUpload = require('express-fileupload');

module.exports = function(app) {
  app.use(express.json());
  app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

  // enable files upload
  app.use(
    fileUpload({
      createParentPath: true
    })
  );

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(morgan('dev'));
  app.use(error);

  /* var whitelist = ['http://localhost:3000']
  var corsOptions = {
    origin: function (origin, callback) {
      if (whitelist.indexOf(origin) !== -1) {
        callback(null, true)
      } else {
        callback(new Error('Not allowed by CORS'))
      }
    }
  } */

  // Then pass them to cors:
  // app.use(cors(corsOptions));

  app.use(cors());
  app.options('*', cors());

  //app.use('/api/testroute', testroute);
  app.use('/api/IAMController', iamroute);

  dotenv.config();
};
