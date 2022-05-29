import React from 'react'

class Rectangle extends React.Component {
  state = { value: 0 };
  static defaultProps = {
    x: 0,
    y: 0,
    w: 20,
    h: 20,
    Radius: 10,
    Rounded: false,
    ForeColor: "white",
    Thickness: 2
  };

  render() {
    const { x, y, w, h, Radius, Rounded, ForeColor, Thickness } = this.props;

    return (
      <div
        className='noselect'
        style={{
          position:"absolute",
          left:x + "px",
          top:y + "px",
          width:w + "px",
          height:h + "px",
          borderRadius: Rounded ? Radius : 0,
          borderStyle: "solid",
          borderWidth: Thickness,
          borderColor: ForeColor,
          boxSizing: "border-box"
        }}
      >
      </div>
    );
  }
}

export default Rectangle