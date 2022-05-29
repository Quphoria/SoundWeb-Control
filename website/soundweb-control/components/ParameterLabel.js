import React from 'react'

import ControlElement from './ControlElement'

const valign_lookup = {
  "Top": "start",
  "Middle": "center",
  "Bottom": "end"
}
const halign_lookup = {
  "Left": "start",
  "Center": "center",
  "Right": "end"
}

class ParameterLabel extends ControlElement {
  state = { value: "Loading..." };
  static defaultProps = {
    x: 0,
    y: 0,
    w: 500,
    h: 50,
    borderStyle: "none",
    text: "Loading...",
    BackColor: "transparent",
    VAlign: "middle",
    HAlign: "center"
  };

  componentDidMount() {
    this.setState({ value: this.props.text });
    this.subscribeToParameter();
    document.addEventListener('soundweb_data', (event) => {
      if (event.detail.type == "SET" && event.detail.parameter == this.props.parameter) {
        this.setState({ value: this.parameterValueToString(event.detail.value) });
      }
    }, false);
  };

  render() {
    const { x, y, w, h, font, BackColor, VAlign, HAlign, borderStyle } = this.props;
    
    return (
      <div
        className='noselect'
        style={{
          position:"absolute",
          background: BackColor,
          left:x,
          top:y,
          width:w,
          height:h,
          font: font,
          wordWrap: "break-word",
          border: 1,
          boxSizing: "border-box",
          borderStyle: borderStyle,
          textAlign: HAlign.toLowerCase(),
          padding: "0.25em",
          zIndex: 2,
          display: "flex",
          justifyContent: halign_lookup[HAlign],
          alignItems: valign_lookup[VAlign]
        }}
      >
        { this.props.parameter && 
          this.props.parameter != "none" ? this.state.value : this.props.text }
      </div>
    );
  }
}

export default ParameterLabel