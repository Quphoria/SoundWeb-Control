import React from 'react'

import ControlElement from './ControlElement'

class ComboBox extends ControlElement {
  state = { value: 0 };
  static defaultProps = {
    x: 0,
    y: 0,
    w: 100,
    h: 30,
    BackColor: "white",
    ForeColor: "black",
    values: {}
  };

  componentDidMount() {
    this.subscribeToParameter();
    document.addEventListener('SWSET_' + this.props.parameter, (event) => {
      this.setState({ value: event.detail });
    }, false);
  };

  sendValue = (value) => {
    const event = new CustomEvent('soundweb_msg', {
      detail: {
        type: "SET",
        parameter: this.props.parameter,
        value: value
      }
    });
    document.dispatchEvent(event);
  }

  valueChanged = (event) => {
    const value = parseInt(event.target.value);
    this.setState({ value });
    this.sendValue(value);
  }

  render() {
    const { x, y, w, h, font, values, BackColor, ForeColor, parameter } = this.props;

    var options = [];
    for (const [val, label] of Object.entries(values)) {
      // key attribute is for react
      options.push(<option key={parameter + "-" + val}
        value={String(val)}>
          {label}
        </option>)
    }

    return (
      <div
        style={{
          position:"absolute",
          left:x,
          top:y,
          width:w,
          height:h,
          font: font,
          wordWrap: "break-word"
        }}
      >
        <select className='pointernormal' value={String(this.state.value)}
          onChange={this.valueChanged}
          style={{
            width: "100%",
            height: "100%",
            font: font,
            color: ForeColor,
            backgroundColor: BackColor
          }}
        >
          {options}
        </select>
      </div>
    );
  }
}

export default ComboBox