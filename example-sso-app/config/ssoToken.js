const crypto    = require('crypto');
const fs = require('fs');

import { config } from './config';

const public_filename = ( process.env.DATA_DIR || "" ) + config.ssoPubKeyFile;
var SSOPublicKey = undefined;

export default function validateToken(token) {2
  if (!SSOPublicKey && fs.existsSync(public_filename)) loadSSOKey();

  if (!SSOPublicKey) { // Failed to load
    throw new Error("SSO Public Key missing!");
  }

  if (typeof(token.data) !== "string") {
    throw new Error("Token missing data");
  }
  if (typeof(token.signature) !== "string") {
    throw new Error("Token missing signature");
  }

  try {
    if (crypto.verify("SHA256", Buffer.from(token.data), SSOPublicKey, Buffer.from(token.signature, "base64"))) {
      return JSON.parse(token.data);
    }
    throw new Error("Invalid signature");
  } catch (e) {
    console.log("Error verifying SSO token:", e);
    throw new Error("Failed to verify token");
  }
}

function loadSSOKey() {
  try {
    const publicKeyStr = fs.readFileSync(public_filename).toString();
    if (publicKeyStr) SSOPublicKey = publicKeyStr;
    console.log("Loaded SSO key")
  } catch (e) {
    console.log("Error loading SSO key:", e);
  }
}