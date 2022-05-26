import React from 'react'

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

class Label extends React.Component {
  static defaultProps = {
    x: 0,
    y: 0,
    w: 500,
    h: 50,
    font: "inherit",
    BackColor: "transparent",
    BorderColor: "transparent",
    borderStyle: "solid",
    Thickness: 1,
    VAlign: "middle",
    HAlign: "center"
  }

  render() {
    const { x, y, w, h, font, BackColor, ForeColor, BorderColor, borderStyle, Thickness, VAlign, HAlign, children } = this.props;
    
    return (
      <div
        className='pointernormal'
        style={{
          position:"absolute",
          background: BackColor,
          left:x,
          top:y,
          width:w,
          height:h,
          font: font,
          wordWrap: "break-word",
          color: ForeColor,
          textAlign: HAlign.toLowerCase(),
          borderStyle: borderStyle,
          borderWidth: Thickness,
          borderColor: BorderColor,
          boxSizing: "border-box",
          padding: "0.25em",
          zIndex: 2,
          display: "flex",
          justifyContent: halign_lookup[HAlign],
          alignItems: valign_lookup[VAlign]
        }}
      >
        {children}
      </div>
    );
  }
}

export default Label