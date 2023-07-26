const fs = require('fs');
import { jsonc } from 'jsonc';

const filename = ( process.env.DATA_DIR || "" ) + "config.jsonc";
const defaultConfig = `{
  // This must be kept secret and be at least 32 characters long
  // This is used to encrypt session cookies
  // Generate a 100 character password here: https://1password.com/password-generator/
  "sessionPassword": "complex_password_at_least_32_characters_long",
  // This is the address and port of the soundweb websocket bridge
  // You can use {HOST} to get the current hostname used to connect to the webserver
  "soundwebBridgeWebsocket": "ws://{HOST}:8765",
  // Enable this if ssl is being used (don't enable if http is being used)
  "useSSL": false,
  // Auth Token Secret, generate another 100 character password
  "authTokenSecret": "different_password_at_least_32_characters_long",
  // SSO Allowed Origin URLs list (for CORS), e.g. ["https://example.com"]
  "allowedSSOOrigins": []
}`;

var config = {};

var backup_on_error = true;
var jsonString = "";
try {
  jsonString = fs.readFileSync(filename, "utf8");
  config = jsonc.parse(jsonString);
  if (typeof(config.sessionPassword) !== "string" || config.sessionPassword.length < 32) {
    throw "sessionPassword must be a secret AND SECURE 32+ character string";
  }
  if (config.sessionPassword === "complex_password_at_least_32_characters_long" && process.env.NODE_ENV === "production") {
    console.log("\n")
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    console.log("!!! sessionPassword has not been changed from the default value, please edit config.jsonc !!!")
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    backup_on_error = false; // Don't backup on this error as this may loop after overwriting the config, then deleting the backup
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
    console.log("\n")
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    console.log("!!! authTokenSecret has not been changed from the default value, please edit config.jsonc !!!")
    console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
    backup_on_error = false;
    throw "authTokenSecret is insecure"
  }
  if (!Array.isArray(config.allowedSSOOrigins) || config.allowedSSOOrigins.find((x) => typeof(x) !== "string") !== undefined) {
    throw "Missing allowedSSOOrigins";
  }
} catch (err) {
  console.log("\n")
  console.log("Error loading config:", err);
  fs.writeFileSync(filename, defaultConfig);
  if (backup_on_error && jsonString) {
    console.log("Previous config saved to:", filename + ".backup");
    fs.writeFileSync(filename + ".backup", jsonString);
  }
  throw "Failed to load config";
}

export default config;
module.exports = {
  config
};