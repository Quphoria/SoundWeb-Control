const fs = require('fs');
import { jsonc } from 'jsonc';

const filename = "config.jsonc";
const defaultConfig = `{
  // This must be kept secret and be at least 32 characters long
  // This is used to encrypt session cookies
  // Generate a 100 character password here: https://1password.com/password-generator/
  "sessionPassword": "complex_password_at_least_32_characters_long",
  // This is the address and port of the soundweb websocket bridge
  "soundwebBridgeWebsocket": "ws://192.168.1.2:8765",
  // Enable this if ssl is being used (don't enable if http is being used)
  "useSSL": false,
  // Auth Token Secret, generate another 100 character password
  "authTokenSecret": "different_password_at_least_32_characters_long"
}`;

var config = {};

try {
  const jsonString = fs.readFileSync(filename, "utf8");
  config = jsonc.parse(jsonString);
  if (typeof(config.sessionPassword) !== "string" || config.sessionPassword.length < 32) {
    throw "sessionPassword must be a secret AND SECURE 32+ character string";
  }
  if (config.sessionPassword === "complex_password_at_least_32_characters_long" && process.env.NODE_ENV === "production") {
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    console.log("!!! sessionPassword has not been changed from the default value, please edit config.jsonc !!!")
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    throw "sessionPassword is insecure"
  }
  if (typeof(config.soundwebBridgeWebsocket) !== "string") {
    throw "Missing soundwebBridgeWebsocket";
  }
  if (typeof(config.useSSL) !== "boolean") {
    throw "Missing useSSL";
  }
  if (typeof(config.authTokenSecret) !== "string" || config.authTokenSecret.length < 32) {
    throw "authTokenSecret must be a secret AND SECURE 32+ character string";
  }
  if (config.authTokenSecret === "different_password_at_least_32_characters_long" && process.env.NODE_ENV === "production") {
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    console.log("!!! authTokenSecret has not been changed from the default value, please edit config.jsonc !!!")
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    throw "authTokenSecret is insecure"
  }
} catch (err) {
  console.log("Error loading config:", err);
  fs.writeFileSync(filename, defaultConfig);
  throw "Failed to load config";
}

export default config;
module.exports = {
  config
};