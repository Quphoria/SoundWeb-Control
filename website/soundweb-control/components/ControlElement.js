import React from 'react'
import getSV from '../lib/StateVariable';

class ControlElement extends React.Component {
    static defaultProps = {
      parameter: undefined,
      subscribe_tab: undefined,
      svClass: undefined,
      format: null,
      font: "inherit"
    }
    constructor(props) {
        super(props);
        if (!this.props.parameter) {
            throw new Error('Control Missing Parameter');
        }
    }

    subscribeToParameter() {
        if (this.props.parameter && this.props.parameter !== "none") {
            document.addEventListener('soundweb_connected', (e) => {
                // Check if we are on the correct tab
                if (this.props.subscribe_tab !== undefined &&
                  this.props.subscribe_tab != e.detail.tab) return;

                const event = new CustomEvent('soundweb_msg', {
                  detail: {
                    type: "SUBSCRIBE",
                    parameter: this.props.parameter,
                    value: 0
                  }
                });
                document.dispatchEvent(event);
              }, false);
        }
    }

    parameterValueToString(value) {
      const { svClass, format } = this.props;
      if (svClass === undefined) {
        console.log("Unknown: " + value.toString());
        return value.toString();
      }
      // console.log(getSV(136).vSVToString(0xdeadbeef));
      // console.log((getSV(136).lStringToSV("222.173.190.239")>>>0).toString(16));
      return getSV(svClass).vSVToString(value, false, 3, format);
    }

    parameterStringToValue(string) {
      const { svClass } = this.props;
      if (!(typeof string === 'string' || string instanceof String)) {
        return string;
      }

      return getSV(svClass).lStringToSV(string);
    }

    parameterStateVariable() {
      return getSV(this.props.svClass);
    }
}

export default ControlElement