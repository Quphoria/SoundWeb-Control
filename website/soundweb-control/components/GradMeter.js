import React from 'react'

import ControlElement from './ControlElement'

function scale_percentage(value, min, max) {
  return (value - min) / (max - min)
}

function clamp_percent(value) {
  return value > 1 ? 1 : value < 0 ? 0 : value;
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
    TickCount: 0,
    BackColor1: "#222",
    BackColor2: "#222",
    LowColor: "rgb(0, 225, 0)",
    MidColor: "rgb(225, 225, 0)",
    HighColor: "rgb(225, 0, 0)",
    MidThreshhold: 0.5,
    HighThreshhold: 0.75,
    GradFraction: 0.25, // The percentage gradient height between the colours
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
    this.ticks = props.ticks;
    if (this.ticks.length == 0) { // Generate ticks if we do not have custom ticks specified
      for (var i = 0; i < props.TickCount; i++) {
        const p_value = i/(props.TickCount-1);
        const value = this.p_min + p_value*(this.p_max - this.p_min);
        const svValue = statevariable.fromPercentage(value);
        const label = statevariable.vSVToString(svValue, false, 2); // Generate with units, 2dp
        this.ticks.push({
          pos: value,
          label: label
        });
      }
    }
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
    const { w, h, scale_left, scale_space, font } = this.props;

    const tick_h = (1-value)*h;

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
    const { x, y, w, h, scale } = this.props;
    if (!scale) return;

    return (<div>
      {this.ticks.map(tick => {
        const scaled_pos = scale_percentage(tick.pos, this.p_min, this.p_max);
        if (scaled_pos >= 0 && scaled_pos <= 1) {
          return this.drawTick(scaled_pos, tick.label);
        }
      }, this)}
    </div>)
  }

  draw(output_ctx, temp_canvas, ctx, value) {
    const {w, h, scale, scale_left, scale_space,
      BackColor1, BackColor2, LowColor, MidColor, HighColor,
      GradFraction, leftBorder, rightBorder} = this.props;
    const bar_width = w - (scale ? scale_space : 0) - leftBorder - rightBorder;
    const bar_left = leftBorder + ((scale && scale_left) ? scale_space : 0);
    const threshold_1 = this.MidThreshhold;
    const threshold_2 = this.HighThreshhold;

    // It seems GradFraction is both gradient heights added together?
    const grad_frac = GradFraction / 2; 

    var p_value = clamp_percent(scale_percentage(value, this.p_min, this.p_max));

    ctx.save();
    ctx.clearRect(0, 0, w, h);

    // Create horizontal gradient L->R of BackColor1 to BackColor2
    const gradient = ctx.createLinearGradient(bar_left, 0, bar_left+bar_width, 0);
    gradient.addColorStop(0, BackColor1);
    gradient.addColorStop(1, BackColor2);
    ctx.fillStyle = gradient;
    // Draw background
    ctx.fillRect(bar_left, 0, bar_width, h);

    // Create vertical gradient B->T of LowColor -> MidColor -> HighColor
    const gradient2 = ctx.createLinearGradient(0, h, 0, 0); // (top of canvas is y=0)
    // Add stops either side of the transition regions, so it is solid between them
    gradient2.addColorStop(0, LowColor);
    gradient2.addColorStop(clamp_percent(threshold_1 - (grad_frac/2)), LowColor);
    gradient2.addColorStop(clamp_percent(threshold_1 + (grad_frac/2)), MidColor);
    gradient2.addColorStop(clamp_percent(threshold_2 - (grad_frac/2)), MidColor);
    gradient2.addColorStop(clamp_percent(threshold_2 + (grad_frac/2)), HighColor);
    gradient2.addColorStop(1, HighColor);
    ctx.fillStyle = gradient2;
    // Draw bar (top of canvas is y=0)
    ctx.fillRect(bar_left, h*(1-p_value), bar_width, h);

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