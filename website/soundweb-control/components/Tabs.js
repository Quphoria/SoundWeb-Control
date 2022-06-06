import React from 'react'
import { withRouter } from "next/router"
import Head from 'next/head'
import LoadingOverlay from 'react-loading-overlay-ts';

import WebSocket from './Websocket'
import PanelContents from '../PanelContents'

class Tabs extends React.Component {
  constructor(props) {
    super(props);
    this.subtab = [];
    this.state = {connected: false};
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
    // Dirty hack to use correct context when calling class method
    document.addEventListener('soundweb_msg',
      this.messageEvent.bind(this),
      false);
    document.dispatchEvent(new CustomEvent('soundweb_connected'));
  }

  setupWebsocket() {
    this.websocket = new WebSocket({
      url: this.props.websocket,
      onMessage: (data) => {
        let result = JSON.parse(data);
        const event = new CustomEvent('soundweb_data', { detail: result });
        document.dispatchEvent(event);
      },
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
      reconnectIntervalInMilliSeconds: 5000 // Auto reconnect after 5 seconds
    });
    this.websocket.connect();
  }

  componentDidMount() {
    function pointerLockError() {
      console.log(" Error locking pointer .");
    }
    
    document.addEventListener("pointerlockerror", pointerLockError)
    document.addEventListener("mozpointerlockerror", pointerLockError)
    document.addEventListener("webkitpointerlockerror", pointerLockError)
    this.setupWebsocket();
    
    function lockChangeAlert(e) {
      console.log(e)
      if(document.pointerLockElement) {
        console.log('The pointer lock status is now locked');
        // Do something useful in response
      } else {
        console.log('The pointer lock status is now unlocked');
        // Do something useful in response
      }
    }
    if ("onpointerlockchange" in document) {
      document.addEventListener('pointerlockchange', lockChangeAlert, false);
    } else if ("onmozpointerlockchange" in document) {
      document.addEventListener('mozpointerlockchange', lockChangeAlert, false);
    }
  }

  componentWillUnmount() {
    this.websocket && this.websocket.close();
  }

  setSubtab(depth, value, doUpdate=true) {
    var subtab = this.subtab;
    while (subtab.length < depth - 1) {
      subtab.push(0);
    }
    subtab = subtab.slice(0, depth);
    if (value != 0) {
      subtab.push(value);
    }
    this.subtab = subtab;
    if (doUpdate) {
      // Use this instead of storing in this.state
      // So we can overwrite this before redirect
      this.forceUpdate();
    }
  }

  render() {
    const {
      query,
      pathname
    } = this.props.router;
    const { hiddenTabs } = this.props;

    return (
      <div>
        <Head>
          <title>SoundWeb Panel</title>
          <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        </Head>
        <LoadingOverlay
          active={!this.state.connected}
          spinner
          text='Connecting...'
          styles={{
            wrapper: {
              display: "inline-block",
              position: "relative"
            }
          }}
          >
          <PanelContents query={query} pathname={pathname} setSubtab={this.setSubtab.bind(this)} subtab={this.subtab} hiddenTabs={hiddenTabs} />
        </LoadingOverlay>
      </div>
    );
  }
}

export default withRouter(Tabs)