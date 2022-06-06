import React from 'react'
import { withRouter } from "next/router"

import WebSocket from '../Websocket'

class Tabs extends React.Component {
  constructor(props) {
    super(props);
    this.state = {connected: false, nodes: {}, version: "Unknown"};
  }

  handleData(msg) {
    const { type, data } = JSON.parse(msg);
    switch (type) {
      case "status":
        this.setState({nodes: data});
        break;
      case "version":
        this.setState({version: data});
        break;
    }
  }

  messageEvent(event) {
    document.ws = this.websocket;

    if (this.websocket?.readyState() == 1) { // Connected
      const result = this.websocket.sendMessage(JSON.stringify(event.detail));
      if (this.state.connected !== result) {
        this.setState({connected: result})
      }
    }
    if (!this.websocket) {
      this.setupWebsocket();
    }
  }

  websocketConnected() {
    console.log("Connected");
    this.websocket.sendMessage("status"); // Get status
    this.websocket.sendMessage("version"); // Get version
  }

  setupWebsocket() {
    this.websocket = new WebSocket({
      url: this.props.websocket,
      onMessage: this.handleData.bind(this),
      // Dirty hack to use correct context in callback
      onOpen: (() => {
        this.websocketConnected();
        this.setState({connected: true});
      }).bind(this),
      onClose: (() => {
        this.setState({connected: false});
      }).bind(this),
      onError: (() => {
        this.setState({connected: this.websocket?.readyState() === 1})
      }).bind(this),
      reconnect: true,
      debug: true,
      use_auth: true,
      options: {statusonly: true},
      reconnectIntervalInMilliSeconds: 5000 // Auto reconnect after 5 seconds
    });
    this.websocket.connect();
  }

  componentDidMount() {
    this.setupWebsocket();
    this.timer = setInterval(() => this.websocket.sendMessage("status"), 10000); // Refresh status every 10 seconds
  }

  componentWillUnmount() {
    this.websocket && this.websocket.close();
    clearTimeout(this.timer);
  }

  frontendVersion() {
    return (<div style={{
      display: "inline-block",
      paddingLeft: "1em",
      whiteSpace: "nowrap"
    }}>
      <b>Frontend:</b> {process.env.VERSION || (process.env.NODE_ENV !== "production" && "Dev") || "Unknown"}
    </div>)
  }

  render() {
    const { connected, nodes, version } = this.state;

    const all_connected = Object.values(nodes).every(x => x === true);

    return (
      <div className="card bg-transparent border-secondary" style={{
          padding: "0.5em", 
          marginBottom: "0.2em", 
          width: "fit-content"
        }}>
        <div style={{display: !connected ? "block" : "none"}}>
          <span style={{fontWeight: "bold"}}>
            <i className="bi bi-exclamation-triangle-fill text-danger" style={{marginRight: "0.5em"}}/>
            Backend Offline
          </span>
          {this.frontendVersion()}
        </div>
        <div style={{display: connected ? "block" : "none"}}>
          <i className={`bi bi-hdd-rack-fill ${all_connected ? "text-success" : "text-warning"}`}
            style={{marginRight: "0.5em"}}/>
          <span style={{fontWeight: "bold"}}>Backend Node Status:</span>
          {Object.entries(nodes).map(([node, status]) => (
            <div style={{
              display: "inline-block",
              paddingLeft: "1em",
              whiteSpace: "nowrap"
            }}>
              {status ? "✔️" : "❌"}{node}
            </div>
          ))}
          <div style={{
              display: "inline-block",
              paddingLeft: "1em",
              whiteSpace: "nowrap"
            }}>
              <b>Backend:</b> {version}
          </div>
          {this.frontendVersion()}
        </div>
      </div>
    );
  }
}

export default withRouter(Tabs)