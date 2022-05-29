# Instructions for building manually

### Building the panel

1. Enter the `panelparser` directory  
2. Build the panel format using `python panelparser.py Example.panel`  
3. Copy the contents of the `output` directory into `soundweb-control`  
  
4. Enter the `soundweb-control` directory
5. Run `npm run build`

## Running the server

1. Enter the `backend` directory
2. Run `env\Scripts\activate`
3. Run `python websocket_bridge_multi.py`

1. In another terminal enter the `soundweb-control` directory
2. Run `npm run start`