// Modified version of https://github.com/alamorre/nextjs-websocket

var W3CWebSocket = require('websocket').w3cwebsocket;

class WebSocket {
  constructor(props) {
    this.props = props;
    this.attempts = 1;
    this.sendMessage = this.sendMessage.bind(this);
    this.connect = this.connect.bind(this);
    this.ws_test = null;
    this.test_ok = false;
  }

  logging(logline) {
    if (this.props.debug === true) {
      console.log(logline);
    }
  }

  testInterval() {
    if (!this.test_ok) {
      this.ws.close(1000, "Ping test failed");
    } else {
      this.sendMessage("__test__");
      this.test_ok = false;
    }
  }

  generateInterval(k) {
    if (this.props.reconnectIntervalInMilliSeconds > 0) {
      return this.props.reconnectIntervalInMilliSeconds;
    }
    return Math.min(30, Math.pow(2, k) - 1) * 1000;
  }

  setupWebsocket(auth_token) {
    let websocket = new W3CWebSocket(this.props.url);
    this.ws = websocket;
    if (this.ws_test) {
      clearInterval(this.ws_test);
      this.ws_test = null;
    }

    websocket.onopen = () => {
      this.logging('Websocket connected...');
      this.test_ok = false;
      this.sendMessage(auth_token);

      if (typeof this.props.onOpen === 'function') this.props.onOpen();
      setInterval(this.testInterval.bind(this), 2000) // Check websocket every 2 seconds
    };

    websocket.onerror = e => {
      if (typeof this.props.onError === 'function') this.props.onError(e);
    };

    websocket.onmessage = evt => {
      if (evt.data === "__test__") {
        this.test_ok = true;
      } else {
        this.props.onMessage(evt.data);
      }
    };

    this.shouldReconnect = this.props.reconnect;
    websocket.onclose = evt => {
      if (this.ws_test) {
        clearInterval(this.ws_test);
        this.ws_test = null;
      }
      this.logging(
        `Websocket disconnected,the reason: ${evt.reason},the code: ${evt.code}`
      );
      if (typeof this.props.onClose === 'function')
        this.props.onClose(evt.code, evt.reason);
      if (this.shouldReconnect) {
        let time = this.generateInterval(this.attempts);
        this.timeoutID = setTimeout(() => {
          this.attempts++;
          this.connect();
        }, time);
      }
    };
  }

  connect() {
    // Websocket auth
    if (!this.props.use_auth) {
      this.setupWebsocket("__test__");
    } else {
      fetch("/api/auth_token", {method: 'POST'}).then(res => res.json()).then(auth => {
        this.setupWebsocket(JSON.stringify(auth));
      }).catch(error => {
        console.error("Failed to get websocket auth token:", error);
        if (this.shouldReconnect) {
          let time = this.generateInterval(this.attempts);
          this.timeoutID = setTimeout(() => {
            this.attempts++;
            this.connect();
          }, time);
        }
      });
    }
  }

  close() {
    this.shouldReconnect = false; // Prevent reconnection
    this.ws && this.ws.close();
  }

  readyState() {
    if (this.ws) {
      return this.ws.readyState;
    }
    return 3; // CLOSED
  }

  sendMessage(message) {
    if (this.ws) {
      this.ws.send(message);
      console.log("WS State:", this.ws?.readyState);
      return true;
    }
    return false;
  }
}

export default WebSocket