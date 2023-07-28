const fs = require('fs');
const { parse, stringify, assign} = require('comment-json');

const filename = ( process.env.DATA_DIR || "" ) + "config.jsonc";
const defaultConfigString = `{
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

var defaultConfig = {};
try {
  defaultConfig = parse(defaultConfigString);
} catch (err) {
  console.log("Error loading default config:", err);
  throw "Failed to load default config";
}

var config = {};

var backup_on_error = true;
var jsonString = "";
var invalid_optional_config = false;
try {
  jsonString = fs.readFileSync(filename, "utf8");
  config = parse(jsonString);

  const required_config_tests = { // Test returns false on failure (or throws an error)
    "sessionPassword": (x) => {
      if (typeof(x) !== "string" || x < 32) throw "sessionPassword must be a secret AND SECURE 32+ character string";
      if (x === "complex_password_at_least_32_characters_long" && process.env.NODE_ENV === "production") {
        console.log("\n")
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        console.log("!!! sessionPassword has not been changed from the default value, please edit config.jsonc !!!")
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        backup_on_error = false; // Don't backup on this error as this may loop after overwriting the config, then deleting the backup
        throw "sessionPassword is insecure"
      }
      return true;
    },
    "soundwebBridgeWebsocket": (x) => (typeof(x) === "string"),
    "useSSL": (x) => (typeof(x) === "boolean"),
    "authTokenSecret": (x) => {
      if (typeof(x) !== "string" || x < 32) throw "authTokenSecret must be a secret AND SECURE 32+ character string";
      if (x === "complex_password_at_least_32_characters_long" && process.env.NODE_ENV === "production") {
        console.log("\n")
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        console.log("!!! authTokenSecret has not been changed from the default value, please edit config.jsonc !!!")
        console.log("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        backup_on_error = false; // Don't backup on this error as this may loop after overwriting the config, then deleting the backup
        throw "authTokenSecret is insecure"
      }
      return true;
    },
  };

  for (const [key, test] of Object.entries(required_config_tests)) {
    if (test(config[key])) continue;

    throw `Missing ${key}`;
  }

  const optional_config_tests = { // Test returns false on failure (or throws an error)
    "allowedSSOOrigins": (x) => (Array.isArray(x) && x.find((a) => typeof(a) !== "string") === undefined),
  };

  for (const [key, test] of Object.entries(optional_config_tests)) {
    try {
      if (test(config[key])) continue;
    } catch (e) {
      console.log(`Error with config entry ${key} test:`, e);
    }
    console.log(`Config entry ${key} is invalid`);
    invalid_optional_config = true;
    config = assign(config, defaultConfig, [key]);
  }

  if (invalid_optional_config) throw "Invalid optional config entry";

} catch (err) {
  console.log("\n")
  console.log("Error loading config:", err);
  if (backup_on_error && jsonString) {
    console.log("Previous config saved to:", filename + ".backup");
    fs.writeFileSync(filename + ".backup", jsonString);
  }

  if (invalid_optional_config) {
    fs.writeFileSync(filename, stringify(config, null, 2));
  } else {
    fs.writeFileSync(filename, defaultConfig);
    throw "Failed to load config";
  }
}

export default config;
module.exports = {
  config
};