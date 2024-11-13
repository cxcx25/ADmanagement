require('dotenv').config();
const ActiveDirectory = require('activedirectory2');

// Use the environment variables for AD configuration
const config = {
  url: process.env.LUX_AD_URL,          // LDAP URL
  baseDN: process.env.LUX_AD_BASE_DN,   // Base DN
  username: process.env.LUX_AD_BIND_DN, // The Bind DN
  password: process.env.LUX_AD_PASSWORD, // The Bind Password
};

// Create an ActiveDirectory instance
const ad = new ActiveDirectory(config);

// Debugging information
console.log(`Using LDAP Server URL: ${config.url}`);
console.log('Bind DN:', config.username);

// Perform a search to get all users
ad.findUsers('(&(objectClass=user)(objectCategory=person))', true, function(err, users) {
    if (err) {
        console.error('LDAP Search Error:', err);
        return;
    }

    if (!users) {
        console.log('No users found.');
    } else {
        console.log('Users found:', users);
    }
});
