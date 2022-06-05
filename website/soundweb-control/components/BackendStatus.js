import React from 'react'
import { withRouter } from "next/router"
import Head from 'next/head'
import LoadingOverlay from 'react-loading-overlay-ts';

import WebSocket from './Websocket'
import PanelContents from '../PanelContents'

class Tabs extends React.Component {
  constructor(props) {
    super(props);
    this.state = {connected: false, nodes: {}};
  }

  handleData(data) {
    const nodes = JSON.parse(data);
    this.setState({nodes});
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
      options: {status: true},
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

  render() {
    const { connected, nodes } = this.state;

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
        </div>
        <div style={{display: connected ? "block" : "none"}}>
          <i className={`bi bi-hdd-rack-fill ${all_connected ? "text-success" : "text-warning"}`}
            style={{marginRight: "0.5em"}}/>
          <span style={{fontWeight: "bold"}}>Backend Node Status:</span>
          {Object.entries(nodes).map(([node, status]) => (
            <span style={{
              paddingLeft: "1em"
            }}>
              {status ? "✔️" : "❌"}{node}
            </span>
          ))}
        </div>
      </div>
    );
  }
}

export default withRouter(Tabs)