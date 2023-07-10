const crypto    = require('crypto');
const fs = require('fs');

const filename = ( process.env.DATA_DIR || "" ) + "SSO.priv";
const public_filename = ( process.env.DATA_DIR || "" ) + "SSO.pub";
var SSOPrivateKey = undefined;
var SSOPublicKey = undefined;

export default function createSSOToken(username, admin, sso_app_id) {
  if (!SSOPrivateKey && fs.existsSync(filename)) loadSSOKey();

  if (!SSOPrivateKey) { // Failed to load
    return {
      status: "error",
      msg: "SSO Private Key not generated!"
    };
  }

  const data = JSON.stringify({
    username, 
    admin,
    time: Date.now(),
    sso_app_id
  });

  var signature = "";
  try {
    if (!SSOPrivateKey) throw Error("No signature")
    signature = crypto.sign("SHA256", Buffer.from(data), SSOPrivateKey).toString('base64');
  } catch (e) {
    console.log("Error signing SSO token:", e);
    return {
      status: "error",
      msg: "Failed to sign token"
    };
  }

  if (!signature) return;

  return {
    status: "ok",
    data: data,
    signature
  };
}

export function generateSSOKeys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  const privateKeyStr = privateKey.export({type: "pkcs1", format: "pem"});
  const publicKeyStr = publicKey.export({type: "pkcs1", format: "pem"});

  fs.writeFileSync(filename, privateKeyStr);
  fs.writeFileSync(public_filename, publicKeyStr);

  console.log("New SSO keys generated");
  SSOPrivateKey = "";
  SSOPublicKey = "";
}

function loadSSOKey() {
  try {
    const privateKeyStr = fs.readFileSync(filename).toString();
    if (privateKeyStr) SSOPrivateKey = privateKeyStr;
    const publicKeyStr = fs.readFileSync(public_filename).toString();
    if (publicKeyStr) SSOPublicKey = publicKeyStr;
    console.log("Loaded SSO keys")
  } catch (e) {
    console.log("Error loading SSO keys:", e);
  }
}

export function getPublicKey() {
  if (!SSOPublicKey) loadSSOKey();
  if (!SSOPublicKey) return "No SSO key generated, please generate a new one";
  return SSOPublicKey;
}