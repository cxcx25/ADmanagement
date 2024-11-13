require('dotenv').config();

const adConfig = {
  lux: {
    server: process.env.LUX_AD_SERVER,
    bindDN: process.env.LUX_AD_BIND_DN,
    password: process.env.LUX_AD_PASSWORD
  },
  essilor: {
    server: process.env.ESSILOR_AD_SERVER,
    bindDN: process.env.ESSILOR_AD_BIND_DN,
    password: process.env.ESSILOR_AD_PASSWORD
  }
};

module.exports = adConfig;
