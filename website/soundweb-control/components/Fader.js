import React from 'react'

import { Range, Direction } from '@quphoria/react-range';

import ControlElement from './ControlElement'

class Fader extends ControlElement {
  state = { values: [0], handleWidth: 0, handleHeight: 0 };
  static defaultProps = {
    x: 0,
    y: 0,
    w: 42,
    h: 500,
    min: undefined,
    max: undefined,
    trackCenter: 0.5,
    trackStart: 0.1,
    trackEnd: 0.9,
    trackWidth: 10,
    handleWidth: 30,
    handleHeight: 50,
    vertical: true,
    sliderImg: "/resources/SliderH_AH.png",
    capOffsetX: 0,
    capOffsetY: 0,
    showTicks: false,
    ticksLeft: false,
    ticksRight: true,
    tickLength: 40,
    ForeColor: "white",
    ticks: []
  };

  constructor(props) {
    super(props);
    this.rangeRef = React.createRef();
    this.lastChanging = 0;
    this.state.handleHeight = this.props.handleHeight;
    this.state.handleWidth = this.props.handleWidth;
    this.state.values = [this.parameterStateVariable()?.min]
    this.changeTimeout = undefined;
  }  

  componentDidMount() {
    this.subscribeToParameter();
    document.addEventListener('soundweb_data', (event) => {
      var range = undefined;
      if (this.rangeRef) {
        range = this.rangeRef.current;
      }
      if (event.detail.type == "SET" && event.detail.parameter == this.props.parameter) {
        
        if (!(range !== null && range.state !== undefined &&
            range.state.draggedThumbIndex !== undefined &&
            range.state.draggedThumbIndex !== -1)) {
          // console.log(range.state.draggedThumbIndex)
          this.setState({ values: [event.detail.value] });
        }
      }
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

  valueChanged = (values) => {
    this.setState({ values });
    this.sendValue(values[0]);
  }

  
  valueChanging = (values) => {
    clearTimeout(this.changeTimeout); // Clear send message timeout
    this.setState({ values });
    const t = Date.now();
    // Only send update message every 50 milliseconds
    const msg_rate = 50;
    if (t - this.lastChanging > msg_rate) {
      this.lastChanging = t;
      this.sendValue(values[0]);
    } else {
      // Send message after timeout if this is the last message sent in a while
      this.changeTimeout = setTimeout(() => this.sendValue(values[0]), msg_rate);
    }
  }

  imgLoaded = (e) => {
    const img = e.currentTarget;
    const { vertical } = this.props;
    const img_width = img.naturalWidth;
    const img_height = img.naturalHeight;

    if (this.state.handleWidth == 0 || this.state.handleHeight == 0) {
      this.setState({
        handleWidth: vertical ? img_height : img_width,
        handleHeight: vertical ? img_width : img_height
      });
    }
  }

  drawTick(value, text) {
    const { ticksLeft, ticksRight, tickLength, trackWidth, font, h, trackStart, trackEnd, ForeColor } = this.props;
    const trackLength = h*(trackEnd-trackStart);

    return ( <div
      key={value}
      style={{
        position: "absolute",
        bottom: value*trackLength,
        left: ticksLeft ? -tickLength : 0,
        boxSizing: "border-box",
        backgroundColor: ForeColor,
        color: ForeColor,
        height: '1px',
        width: (tickLength*( ticksLeft && ticksRight ? 2 : 1 ))+trackWidth
      }}
    >
      { ticksLeft && <div
        className='noselect'
        style={{
          position: "absolute",
          top: "calc(0px - 1em)",
          right: (tickLength*( ticksLeft && ticksRight ? 2 : 1 ))+trackWidth,
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          height: "2em",
          paddingRight: '0.4em',
          font: font
        }}
      >
        {text}
      </div> }
      { ticksRight && <div
        className='noselect'
        style={{
          position: "absolute",
          top: "calc(0px - 1em)",
          left: (tickLength*( ticksLeft && ticksRight ? 2 : 1 ))+trackWidth,
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          height: "2em",
          paddingLeft: '0.4em',
          font: font
        }}
      >
        {text}
      </div> }
    </div> )
  }

  getTicks() {
    const { showTicks, ticks } = this.props;
    if (!showTicks) return;

    const statevariable = this.parameterStateVariable();
    const p_min = statevariable.getPercentage(this.props.min == undefined ? statevariable.min : this.parameterStringToValue(this.props.min));
    const p_max = statevariable.getPercentage(this.props.max == undefined ? statevariable.max : this.parameterStringToValue(this.props.max));

    return ( <div>
      {ticks.map(tick => {
        const scaled_pos = (tick.pos - p_min) / (p_max - p_min);
        if (scaled_pos >= 0 && scaled_pos <= 1) {
          return this.drawTick(scaled_pos, tick.label)
        }
      }, this)} 
    </div>);
  }

  render() {
    const { x, y, w, h, font, trackCenter, trackStart, trackEnd, trackWidth, vertical, sliderImg, capOffsetX, capOffsetY } = this.props;
    const { handleWidth, handleHeight } = this.state;
    const statevariable = this.parameterStateVariable();

    const min = this.props.min == undefined ? statevariable.min : this.parameterStringToValue(this.props.min);
    const max = this.props.max == undefined ? statevariable.max : this.parameterStringToValue(this.props.max);
    const sv_range = max - min;

    const stepsize = sv_range > 2000000 ? Math.floor(sv_range / 2000000) : 1;

    return (
      <div
        style={{
          position:"absolute",
          left:x + w*trackCenter,
          top:y + h*(1-trackEnd)
        }}
      >
        <Range
          ref={this.rangeRef}
          step={stepsize}
          min={min}
          max={max}
          values={this.state.values}
          direction={Direction.Up}
          onChange={this.valueChanging}
          onFinalChange={this.valueChanged}
          relativeDrag={true}
          lockPointer={true}
          speed={0.3}
          shiftSpeed={1.0}
          lockedSpeedAdjustment={1.0}
          renderTrack={({ props, children }) => (
            <div
              {...props}
              style={{
                ...props.style,
                height: h*(trackEnd-trackStart),
                width: trackWidth,
                backgroundColor: 'white',
                color: 'white'
              }}
            >
              {children}
              { this.getTicks() }
            </div>
          )}
          renderThumb={({ props }) => (
            <div
              {...props}
              style={{
                ...props.style,
                height: handleHeight,
                width: handleWidth,
                zIndex: 4,
                outline: 'none'
              }}
            >
              <img src={sliderImg}
                className={vertical ? "rotate90" : ""}
                onLoad={this.imgLoaded.bind(this)}
                style={{
                  width: handleHeight + "px",
                  height: handleWidth + "px",
                  position: "absolute",
                  top: capOffsetY + "px",
                  left: capOffsetX + "px",
                  zIndex: 4
                }}
              />
              {/* Larger div to increase click region (for mobile touch) */}
              <div style={{
                position: "absolute",
                left: "-1vw",
                top: "-1vh",
                width: "calc(" + handleWidth + "px + 2vw)",
                height: "calc(" + handleHeight + "px + 2vh)",
                // backgroundColor: "#e83474"
              }}>
              </div>
            </div>
          )}
        />
      </div>
    );
  }
}

export default Fader