const fs = require('fs');

const filename = ( process.env.DATA_DIR || "" ) + "users.json";
var users = [];

export const userDatabase = {
  load,
  getAll: () => users,
  getById: id => users.find(x => x.id === id),
  find: x => users.find(x),
  create,
  update,
  delete: _delete
};

function migrateDatabase() {
  var new_users = [];
  var changed = false;
  for (const user of users) {
    var user_changed = false;
    // user: object
    // user.id: unique number
    // user.username: unique string (not empty) (unique case-insensitive)
    // user.password: string (not empty)
    // Optional:
    // user.admin: boolean
    // user.disabled: boolean
    // user.lastLogin: string
    // user.lastChange: string
    // user.hiddenTabs: array of strings

    if (typeof(user) !== 'object') break;
    if (typeof(user.id) !== "number" || new_users.find(x => x.id === user.id)) break;
    if (typeof(user.username) !== "string" || user.username === "" || new_users.find(x => x.username.toLowerCase() === user.username.toLowerCase())) break;
    if (typeof(user.password) !== "string" || user.password === "") break;
    
    if (typeof(user.admin) !== "boolean") { user.admin = false; user_changed = true; }
    if (typeof(user.disabled) !== "boolean") { user.disabled = false; user_changed = true; }
    if (typeof(user.lastLogin) !== "string") { user.lastLogin = "Unknown"; user_changed = true; }
    if (typeof(user.lastChange) !== "string") { user.lastChange = "Unknown"; user_changed = true; }
    if (!Array.isArray(user.hiddenTabs) || user.hiddenTabs.find(x => typeof(x) !== "string") !== undefined) {
      user.hiddenTabs = [];
      user_changed = true;
    }
    if (user_changed)  {
      user.dateUpdated = new Date().toISOString();
      changed = true;
    }
    new_users.push(user);
  }
  if (changed || new_users.length !== users.length) {
    console.log("User Database Migrated");
    users = new_users;
    saveData();
  }
}

function load() {  
  var jsonString = "";
  try {
    jsonString = fs.readFileSync(filename, "utf8");
    var loaded_users = JSON.parse(jsonString);
    if (!Array.isArray(loaded_users)) {
      console.log("")
      throw "User database must be an array";
    }
    users = loaded_users;
  } catch (err) {
    console.log("Error loading User database:", err);
    if (jsonString) {
      console.log(`Corrupt database moved to ${filename}.backup`);
      fs.writeFileSync(filename + ".backup", jsonString);
    }
    console.log(`Writing new database to ${filename}`);
    console.log("Admin Account Credentials:");
    console.log("Username: admin, Password: admin");

    // Write default user data
    users = users = [{
      id: 0,
      username: "admin",
      password: "admin",
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      lastChange: new Date().toISOString(),
      admin: true
    }];
    saveData();
  }
  migrateDatabase();
}

export function sanitised(user) {
  // This function returns data that can be received by clients
  // E.g. it doesn't return the password
  if (user === undefined) {
    throw { message: "No user provided" };
  }

  const { id, username, admin, disabled, lastLogin, hiddenTabs } = user;

  return { id, username, admin, disabled, lastLogin, hiddenTabs };
}

function create(user) {
  // Check for username and password

  if (user.username == undefined || user.username == "") {
    throw {
      message: "Missing Username"
    }
  };
  if (user.password == undefined || user.password == "") {
    throw {
      message: "Missing Password"
    };
  }
  if (userDatabase.find((u) => u.username == user.username)) {
    throw {
      message: "Username taken"
    };
  }

  // generate new user id
  user.id = users.length ? Math.max(...users.map(x => x.id)) + 1 : 1;

  // set date created and updated
  user.dateCreated = new Date().toISOString();
  user.dateUpdated = new Date().toISOString();
  user.lastChange = new Date().toISOString();
  user.lastLogin = "Never";

  // Setup other data
  user.hiddenTabs = user.hiddenTabs !== undefined ? user.hiddenTabs : [];
  user.admin = user.admin !== undefined ? user.admin : [];
  user.disabled = user.disabled !== undefined ? user.disabled : [];
  
  // add and save user
  users.push(user);
  saveData();
  return user.id;
}

function update(id, params) {
  const user = users.find(x => x.id.toString() === id.toString());
  if (user === undefined) {
    throw { message: `Cannot find user ${id}` };
  }

  if (params.id !== undefined) {
    throw { message: "User ID cannot be changed" };
  }

  // set date updated
  user.dateUpdated = new Date().toISOString();

  // update and save
  Object.assign(user, params);
  saveData();
}

// prefixed with underscore '_' because 'delete' is a reserved word in javascript
function _delete(id) {
  // filter out deleted user and save
  users = users.filter(x => x.id.toString() !== id.toString());
  saveData();

}

// private helper functions

function saveData() {
  fs.writeFileSync(filename, JSON.stringify(users, null, 4));
}