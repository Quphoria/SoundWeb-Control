import { userDatabase } from './userDatabase';

const fs = require('fs');

const filename = ( process.env.DATA_DIR || "" ) + "sso_apps.json";
var ssoApps = [];

export const ssoAppDatabase = {
  load,
  getAll: () => ssoApps,
  find: x => ssoApps.find(x),
  create,
  update,
  delete: _delete
};

function migrateDatabase() {
  var new_ssoApps = [];
  var changed = false;
  for (const ssoApp of ssoApps) {
    // ssoApp: object
    // ssoApp.id: unique string
    // Optional:
    // ssoApp.disabled: boolean

    if (typeof(ssoApp) !== 'object') break;
    if (typeof(ssoApp.id) !== "string" || ssoApp.id == "" || new_ssoApps.find(x => x.id === ssoApp.id)) break;
    if (typeof(ssoApp.disabled) !== "boolean") { ssoApp.disabled = false; changed = true; }

    new_ssoApps.push(ssoApp);
  }
  if (changed || new_ssoApps.length !== ssoApps.length) {
    console.log("SSO App Database Migrated");
    ssoApps = new_ssoApps;
    saveData();
  }
}

function load() {  
  var jsonString = "";
  try {
    jsonString = fs.readFileSync(filename, "utf8");
    var loaded_sso_apps = JSON.parse(jsonString);
    if (!Array.isArray(loaded_sso_apps)) {
      console.log("")
      throw "SSO app database must be an array";
    }
    ssoApps = loaded_sso_apps;
  } catch (err) {
    console.log("Error loading SSO App database:", err);
    if (jsonString) {
      console.log(`Corrupt database moved to ${filename}.backup`);
      fs.writeFileSync(filename + ".backup", jsonString);
    }
    console.log(`Writing new database to ${filename}`);

    // Write default data
    ssoApps = [];
    saveData();
  }
  migrateDatabase();
}

function create(sso_app_id) {

  const ssoApp = {
    id: sso_app_id,
    disabled: false
  };

  if (ssoApps.find((a) => a.id == ssoApp.id)) {
    throw {
      message: "sso_app_id already exists"
    };
  }
  
  // add and save ssoApp
  ssoApps.push(ssoApp);
  saveData();
}

function update(id, params) {
  const ssoApp = ssoApps.find(a => a.id === id);
  if (ssoApp === undefined) {
    throw { message: `Cannot find SSO App ${id}` };
  }

  if (params.id !== undefined) {
    throw { message: "SSO App ID cannot be changed" };
  }

  // update and save
  Object.assign(ssoApp, params);
  saveData();
}

// prefixed with underscore '_' because 'delete' is a reserved word in javascript
function _delete(id) {
  // filter out deleted app and save
  ssoApps = ssoApps.filter(a => a.id !== id);
  saveData();

  userDatabase.load();
  // Remove app from all users
  for (const user of userDatabase.getAll()) {
    if (user.enabledSSOApps.includes(id)) {
      userDatabase.update(user.id, {
        enabledSSOApps: user.enabledSSOApps.filter((a) => (a !== id))
      });
    }
  }
}

// private helper functions

function saveData() {
  fs.writeFileSync(filename, JSON.stringify(ssoApps, null, 4));
}