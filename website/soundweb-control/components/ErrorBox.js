import React from 'react'

class ErrorBox extends React.Component {
  state = { value: 0 };
  static defaultProps = {
    x: 0,
    y: 0,
    w: 20,
    h: 20,
  };

  render() {
    const { x, y, w, h } = this.props;

    return (
      <div
        className='error-blink noselect'
        style={{
          position:"absolute",
          left:x + "px",
          top:y + "px",
          width:w + "px",
          height:h + "px",
          border: 0,
          boxSizing: "border-box"
        }}
      >
        <svg class="error-blink-svg" width="100%" height="100%" viewBox="0 0 10 10" preserveAspectRatio="none">
          <rect fill="none" x="0" y="0" width="10" height="10" vector-effect="non-scaling-stroke"/>
          <line fill="none" x1="0" y1="0" x2="10" y2="10" vector-effect="non-scaling-stroke"/>
          <line fill="none" x1="0" y1="10" x2="10" y2="0" vector-effect="non-scaling-stroke"/>
        </svg>
      </div>
    );
  }
}

export default ErrorBox