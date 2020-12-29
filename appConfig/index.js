const get = key => {
  const config = require('./default.json');
  return config[key];
};

module.exports = {
  get: get
};
