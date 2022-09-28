import React from 'react'

import ControlElement from './ControlElement'

class LED extends ControlElement {
  state = { value: 0 };
  static defaultProps = {
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    colours: [{
      min: -127,
      max: 0,
      colour: 'black'
    },{
      min: 0,
      max: 127,
      colour: 'green'
    }]
  };

  getCurrentColour() {
    const value = this.state.value;
    for (const colourrange of this.props.colours) {
      if (this.parameterStringToValue(colourrange.min) <= value && 
          this.parameterStringToValue(colourrange.max) >= value) {
        return colourrange.colour;
      }
    }
    return 'black'
  }

  componentDidMount() {
    this.subscribeToParameter();
    document.addEventListener('SWSET_' + this.props.parameter, (event) => {
      this.setState({ value: event.detail });
    }, false);
  };


  render() {
    const { x, y, w, h } = this.props;

    return (
      <div
        style={{
          position:"absolute",
          left:x + "px",
          top:y + "px",
          width:w + "px",
          height:h + "px",
          borderRadius: "50%",
          backgroundColor: this.getCurrentColour(),
          backgroundImage: `url(${encodeURI("resources/LedAlpha.png")})`,
          backgroundSize: "140% 140%",
          backgroundPosition: "50% 50%",
          imageRendering: "pixelated"
        }}
      >
      </div>
    );
  }
}

export default LED