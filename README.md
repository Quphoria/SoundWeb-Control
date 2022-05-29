# SoundWeb Control

This is a web based control panel for Hiqnet Devices that compiles the AudioArchitect .panel format into a nextjs component.
It has build in user management
It communicates using a python based websocket server that speaks to HiQnet devices, e.g. SoundWeb Blue Units

## Prerequisites

## Getting Started

### Setting up the docker containers

1. Download the `docker-compose.yml` into the installation directory
2. Create a directory called `data` inside the installation directory
2. Copy the .panel file into the `data` directory and name it `App.panel`
3. Inside the installation directory run `docker compose -p soundweb-control up -d`
4. Edit the config as instructed below
5. Restart the containers

### Configuring the panel

1. Enter the `data` directory
2. Generate a secure session cookie password using a secure generator such as https://1password.com/password-generator/,
  it is recommended to generate a 100 character password for security, this password is used to encrypt the session cookies and does not need to be remembered
3. Set the address and port of the python server with a protocol `ws://`, e.g. `192.168.1.1:8765` (8765 is the default port)
4. If the panel will be accessed over https, set `useSSL` to `true` (an exteral proxy server (e.g. Nginx) will have to be used to handle https traffic and proxy request to the nodejs server)
5. Generate a secure HMAC secret for the websocket in the same way as the session cookie password, again it is recommended to generate a 100 character password

### Configuring the python server

Edit `data/backend-config.json`  
Copy in the secret value for the auth token HMAC from the panel config, otherwise the websocket will be unable to connect.  
Enter the ip address of the main HiQnet device to handle control messages inside the `default` node  
Add additional nodes for other HiQnet devices with their Node ID in hex as the name, DO THIS FOR EVERY SOUNDWEB DEVICE  
If you do not add all the nodes in this config file, you could cause SoundWeb devices to freeze and crash.  

Example config:  
```json
{   
    "authTokenSecret": "authTokenSecret from configuring the panel",
    "nodes": {
        "default": "192.168.1.2",
        "0x1": "192.168.1.2",
        "0x2": "192.168.1.3",
        "0x3": "192.168.1.4"
    },
    "subscription_rate_ms": 100,
    "websocket_port": 8765,
    "authTokenSecret"
}
```
The subscription rate should be left at 100ms, but can be increased if the subscription rate is a bit too fast causing devices to seem laggy  
Leave the websocket port at `8765`, change this port inside `docker-compose.yml`

## Resetting the users

If the admin account password is forgotten the user database can be manually edited or reset
The user database is `users.json`
If you want to reset the user database, you just need to delete `users.json` and restart the NodeJS server

The default login is `admin` `admin`

### Attributions

The icon file (favicon.ico) is by GuillenDesign (Paulo Guillen)  
Licensed under CC Attribution-NonCommercial-NoDerivs  
From: https://icon-icons.com/icon/control-panel/43465  