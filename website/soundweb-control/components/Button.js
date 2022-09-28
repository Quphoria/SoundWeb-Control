import React from 'react'

import ControlElement from './ControlElement'

class Button extends ControlElement {
  state = { value: false };
  static defaultProps = {
    x: 0,
    y: 0,
    w: 100,
    h: 30,
    momentary: false,
    offText: "OFF",
    onText: "ON",
    offImg: "",
    onImg: "",
    offTextColour: "white",
    onTextColour: "white",
    offColour: "black",
    onColour: "black",
    onValue: "1",
    offValue: "0"
  };

  componentDidMount() {
    this.subscribeToParameter();
    document.addEventListener('SWSET_' + this.props.parameter, (event) => {
      this.setState({ value: this.parameterValueToString(event.detail) == this.props.onValue });
    }, false);
  };

  sendValue = (value) => {
    const { onValue, offValue } = this.props;
    const event = new CustomEvent('soundweb_msg', {
      detail: {
        type: "SET",
        parameter: this.props.parameter,
        value: this.parameterStringToValue(value ? onValue : offValue)
      }
    });
    document.dispatchEvent(event);
  }

  buttonPressed = (event) => {
    if (event.button !== 0) return;
    var value = !this.state.value;
    if (this.props.momentary) {
      value = true;
    }
    this.setState({ value });
    this.sendValue(value);
  }

  buttonReleased = (event) => {
    if (event.button !== 0) return;
    if (this.props.momentary) {
      this.setState({ value: false });
      this.sendValue(false);
    }
  }

  render() {
    const { x, y, w, h, font, offText, onText, offImg, onImg, offColour, onColour, offTextColour, onTextColour } = this.props;

    return (
      <div
        style={{
          position:"absolute",
          left:x,
          top:y,
          width:w,
          height:h,
          wordWrap: "break-word",
          textAlign: "center",
          backgroundImage: `url(${encodeURI(this.state.value ? onImg : offImg)})`,
          backgroundSize: "100% 100%", // stretch image to fill
          backgroundColor: this.state.value ? onColour : offColour,
          color: this.state.value ? onTextColour : offTextColour,
          borderRadius: "5px", // Hide background dots in the corners
          borderWidth: (this.state.value ? onImg : offImg) == "" ? 1 : 0, // Show border if no image
          borderStyle: "solid",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          font: font
        }}
        onMouseDown={this.buttonPressed}
        onMouseUp={this.buttonReleased}
      >
        <span className='noselect'>
          {this.state.value ? onText : offText}
        </span>
      </div>
    );
  }
}

export default Button