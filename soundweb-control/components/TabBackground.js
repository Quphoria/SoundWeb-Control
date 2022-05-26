import React, { useRef, useEffect } from 'react'

const TabBackground = (props) => {
  const {
    x, y, w, h,
    BackColor,
    ForeColor,
    font
  } = props;

  return (
    <div style={{
      backgroundColor: BackColor ? BackColor : "black",
      position: (x == 0 && y == 0) ? "relative" : "absolute",
      left: x,
      top: y,
      width: w,
      height: h,
      color: ForeColor ? ForeColor : "white",
      border: 1,
      borderColor: ForeColor ? ForeColor : "white",
      boxSizing: "border-box",
      font: font ? font : "inherit"
    }} >
      {props.children}
    </div>   
  )
}

export default TabBackground