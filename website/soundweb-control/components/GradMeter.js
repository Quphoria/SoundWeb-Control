import React from 'react'

import ControlElement from './ControlElement'

function scale_percentage(value, min, max) {
  return (value - min) / (max - min)
}

class GradMeter extends ControlElement {
  static defaultProps = {
    x: 0,
    y: 0,
    w: 40,
    h: 380,
    scale: false,
    scale_left: false,
    scale_space: 20,
    offColour: "#222",
    LowColor: "rgb(0, 225, 0)",
    MidColor: "rgb(225, 225, 0)",
    HighColor: "rgb(225, 0, 0)",
    MidThreshhold: 0.5,
    HighThreshhold: 0.75,
    GradFraction: 0.2, // The percentage gradient height between the colours
    leftBorder: 1,
    rightBorder: 1,
    ticks: []
  };

  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.tempCanvasRef = React.createRef();
    const statevariable = this.parameterStateVariable();
    this.p_min = statevariable.getPercentage(props.min == undefined ? statevariable.min : this.parameterStringToValue(props.min));
    this.p_max = statevariable.getPercentage(props.max == undefined ? statevariable.max : this.parameterStringToValue(props.max));
    this.MidThreshhold = typeof props.MidThreshhold === 'number' ? props.MidThreshhold : 
      scale_percentage(statevariable.getPercentage(this.parameterStringToValue(props.MidThreshhold)), this.p_min, this.p_max);
    this.HighThreshhold = typeof props.HighThreshhold === 'number' ? props.HighThreshhold : 
      scale_percentage(statevariable.getPercentage(this.parameterStringToValue(props.HighThreshhold)), this.p_min, this.p_max);
  }  

  componentDidMount() {
    this.subscribeToParameter();
    const canvas = this.canvasRef.current;
    const context = canvas.getContext('2d');
    const temp_canvas = this.tempCanvasRef.current;
    const temp_context = temp_canvas.getContext('2d');

    document.addEventListener('SWSET_' + this.props.parameter, (event) => {
      var value = this.parameterStateVariable().getPercentage(event.detail);
      this.draw(context, temp_canvas, temp_context, value);
    }, false);
    
    this.draw(context, temp_canvas, temp_context, 0);
  }

  drawTick(value, text) {
    const { w, h, scale_left, scale_space, gapSize, font } = this.props;

    const tick_h = (1-value)*(h - 2*gapSize) + gapSize;

    return (<div
      className='noselect'
      key={value}
      style={{
        position: "absolute",
        top: "calc(" + tick_h + "px - 1px - 1em)", // apply 1px offset
        left: scale_left ? null : w - scale_space,
        right: !scale_left ? null : w - scale_space,
        textAlign: scale_left ? 'right' : 'left',
        display: 'flex',
        alignItems: 'center',
        height: "2em",
        paddingLeft: !scale_left ? '0.2em' : '0',
        paddingRight: scale_left ? '0.2em' : '0',
        font: font
    }}>
      {text}
    </div>)
  }

  getTicks() {
    const { x, y, w, h, scale, ticks } = this.props;
    if (!scale) return;

    return (<div>
      {ticks.map(tick => {
        const scaled_pos = scale_percentage(tick.pos, this.p_min, this.p_max);
        if (scaled_pos >= 0 && scaled_pos <= 1) {
          return this.drawTick(scaled_pos, tick.label);
        }
      }, this)}
    </div>)
  }

  draw(output_ctx, temp_canvas, ctx, value) {
    const {w, h, scale, scale_left, scale_space, leftBorder, rightBorder,
      offColour, Sec1Color, Sec2Color, Sec3Color,
      segments, gapSize} = this.props;
    const segment_width = w - (scale ? scale_space : 0) - leftBorder - rightBorder;
    const segment_left = leftBorder + ((scale && scale_left) ? scale_space : 0);

    var p_value = scale_percentage(value, this.p_min, this.p_max);
    p_value = p_value > 1 ? 1 : p_value < 0 ? 0 : p_value;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    const fillHeight = h-gapSize;
    for (var i = 0; i < segments; i++) {
      var seg_h = (fillHeight / segments) - 1*gapSize;
      ctx.globalAlpha = 1;
      ctx.fillStyle = offColour;
      ctx.beginPath();
      ctx.rect(segment_left, h - (gapSize + i*(fillHeight / segments)) - seg_h, segment_width, seg_h);
      ctx.fill();
      if (p_value * segments < i) continue; // If segment empty stop drawing
      ctx.fillStyle = Sec1Color;
      if (i/segments > this.threshold_2) ctx.fillStyle = Sec2Color;
      if (i/segments > this.threshold_3) ctx.fillStyle = Sec3Color;
      ctx.beginPath();
      if (p_value * segments < i+1) { // Check if segment isn't full
        ctx.globalAlpha = p_value * segments - i;
        // seg_h *= p_value * segments - i;
      }
      ctx.rect(segment_left, h - (gapSize + i*(fillHeight / segments)) - seg_h, segment_width, seg_h);
      ctx.fill();
    }
    ctx.restore();

    // Do this to prevent flicker while rendering
    output_ctx.clearRect(0, 0, w, h);
    output_ctx.drawImage(temp_canvas, 0, 0)
  }

  render() {
    const {x, y, w, h} = this.props;

    return (
      <div className='GradMeterWrapper' style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h
      }}>
        <canvas ref={this.canvasRef} width={w} height={h} style={{
        }} />
        <canvas ref={this.tempCanvasRef} width={w} height={h} style={{
          display: "none"
        }} />
        { this.getTicks() }
      </div>
    )
  }
}

export default GradMeter