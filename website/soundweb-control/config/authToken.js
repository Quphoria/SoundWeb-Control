const crypto    = require('crypto');
const { config } = require("../config/config.js");

export default function createAuthToken(username, admin, options) {
  const data = JSON.stringify({
    username, 
    admin,
    time: Date.now(),
    options
  });

  const hmac = crypto.createHmac("sha256", config.authTokenSecret);    
  hmac.write(data); // write in to the stream
  hmac.end();       // can't read from the stream until you call end()
  const hash = hmac.read().toString('hex');    // read out hmac digest
  
  const token = {data: data, hash};

  return token
}
