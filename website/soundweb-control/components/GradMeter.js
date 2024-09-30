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
    HighThreshhold: 0.9,
    GradFraction: 0.25, // The percentage gradient height between the colours
    leftBorder: 1,
    rightBorder: 1,
    ticks: [],
    DrawPeak: true,
    PeakWidth: 1,
    PeakColor: "#f5f5f5",
    PeakDecayRate: 10,
    Optimized: false,
    ValueFormat: null,
    // The below properties are not from the panel file
    PeakUpdateRateMs: 20,
  };

  constructor(props) {
    super(props);
    this.canvasRef = React.createRef();
    this.tempCanvasRef = React.createRef();
    this.shadowCanvasRef = React.createRef();
    const statevariable = this.parameterStateVariable();
    this.p_min = statevariable.getPercentage(props.min == undefined ? statevariable.min : this.parameterStringToValue(props.min));
    this.p_max = statevariable.getPercentage(props.max == undefined ? statevariable.max : this.parameterStringToValue(props.max));
    this.ticks = props.ticks;
    this.p_value = 0;
    this.peakpos = 0;
    this.lastpeakupdate_ms = 0;
    if (this.ticks.length == 0) { // Generate ticks if we do not have custom ticks specified
      for (var i = 0; i < props.TickCount; i++) {
        const p_value = i/(props.TickCount-1);
        const value = this.p_min + p_value*(this.p_max - this.p_min);
        const svValue = statevariable.fromPercentage(value);
        const label = statevariable.vSVToString(svValue, false, 2, props.ValueFormat || null); // Generate with units, 2dp
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
    const { parameter, DrawPeak, PeakUpdateRateMs } = this.props;
    this.subscribeToParameter();
    this.canvas =         this.canvasRef.current;
    this.temp_canvas =    this.tempCanvasRef.current;
    this.shadow_canvas =  this.shadowCanvasRef.current;
    this.output_ctx =     this.canvas.getContext('2d');
    this.ctx =            this.temp_canvas.getContext('2d');
    this.shadow_ctx =     this.shadow_canvas?.getContext('2d');

    document.addEventListener('SWSET_' + parameter, (event) => {
      var value = this.parameterStateVariable().getPercentage(event.detail);
      this.p_value = clamp_percent(scale_percentage(value, this.p_min, this.p_max));
      // Update peak
      if (this.p_value >= this.peakpos) {
        this.peakpos = this.p_value;
        this.lastpeakupdate_ms = Date.now();
      }
      this.draw();
    }, false);
    
    this.p_value = 0;
    this.peakpos = 0;
    this.draw();
    this.lastpeakupdate_ms = Date.now();
    if (DrawPeak) {
      // Don't bother if we aren't drawing the peak
      this.peak_interval = setInterval(this.updatePeakPos.bind(this), PeakUpdateRateMs); // Update peak every 20ms
    }
  }

  componentWillUnmount() {
    if (this.peak_interval) clearInterval(this.peak_interval);
  }

  updatePeakPos() {
    const { PeakDecayRate, Optimized } = this.props;
    var dt = (Date.now() - this.lastpeakupdate_ms) / 1000;
    var num = dt * PeakDecayRate * 0.01
    var num = Math.round(num * 100000) / 100000; // Round to 5dp
    var new_peakpos = this.peakpos - num;
    if (new_peakpos < 0) new_peakpos = 0;
    if (new_peakpos < this.p_value) {
      new_peakpos = this.p_value;
      this.lastpeakupdate_ms = Date.now(); // Since we updated it from p_value, update the timestamp
    }
    // If has changed when rounded to 5dp
    if (Math.round(this.peakpos * 100000) != Math.round(new_peakpos * 100000)) {
      this.peakpos = new_peakpos;
      this.lastpeakupdate_ms = Date.now();

      // Redraw
      this.draw();
    }    
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

  draw() {
    const {ctx, output_ctx, shadow_ctx} = this;
    const {w, h, scale, scale_left, scale_space,
      BackColor1, BackColor2, LowColor, MidColor, HighColor,
      GradFraction, leftBorder, rightBorder,
      DrawPeak, PeakWidth, PeakColor, Optimized} = this.props;
    const bar_width = w - (scale ? scale_space : 0) - leftBorder - rightBorder;
    const bar_left = leftBorder + ((scale && scale_left) ? scale_space : 0);
    const threshold_1 = this.MidThreshhold;
    const threshold_2 = this.HighThreshhold;

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
    // These stops are wierd, but are taken from HProGradMeter (see colorBlend variable)
    gradient2.addColorStop(0,           LowColor);
    gradient2.addColorStop(clamp_percent(threshold_1 - (GradFraction * threshold_1)), LowColor);
    gradient2.addColorStop(threshold_1, MidColor);
    gradient2.addColorStop(clamp_percent(threshold_2 - (GradFraction * (threshold_2 - threshold_1))), MidColor);
    gradient2.addColorStop(threshold_2, HighColor);
    gradient2.addColorStop(1,           HighColor);
    ctx.fillStyle = gradient2;
    // Draw bar (top of canvas is y=0)
    var bar_coord = Math.round(h*(1-this.p_value));
    ctx.fillRect(bar_left, bar_coord, bar_width, h);

    // Create horizontal overlay gradient
    if (!Optimized) {
      const gradient3 = ctx.createLinearGradient(bar_left, 0, bar_left+bar_width, 0);
      // Black with alpha = 130, to transparent
      gradient3.addColorStop(0, "rgba(0,0,0,0.5)");
      gradient3.addColorStop(1, "transparent");
      ctx.fillStyle = gradient3;
      // Draw overlay gradient
      // ctx.fillRect(bar_left, 0, bar_width, h);
      // 1px border to give 3d effect
      ctx.fillRect(bar_left+1, 1, bar_width-2, h-2);
    }

    // Draw peak
    if (DrawPeak && this.peakpos > 0) {
      var peak_coord = Math.round(h*(1-this.peakpos)) - 1;
      if (peak_coord < 0) peak_coord = 0; // If too high, cap at top of scale
      
      ctx.strokeStyle = PeakColor;
      ctx.fillStyle = "transparent";
      ctx.lineWidth = PeakWidth;
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      ctx.beginPath();
      // Lines draw from the 0.5, so +- 0.5, otherwise they are dull/blurry
      ctx.moveTo(bar_left-0.5, peak_coord+0.5);
      ctx.lineTo(bar_left+bar_width+0.5, peak_coord+0.5);
      ctx.stroke();
    }

    ctx.restore();

    // Draw shadows in seperate canvas
    if (!Optimized) {
      shadow_ctx.clearRect(0, 0, w, h);
      shadow_ctx.shadowColor = "rgb(255 255 255 / 80%)";
      shadow_ctx.shadowBlur = 1;
      shadow_ctx.shadowOffsetX = 0;
      shadow_ctx.shadowOffsetY = 0;
      shadow_ctx.drawImage(this.temp_canvas, 0, 0);
    }

    // Do this to prevent flicker while rendering
    output_ctx.imageSmoothingEnabled = false;
    output_ctx.mozImageSmoothingEnabled = false;
    output_ctx.clearRect(0, 0, w, h);
    // Copy, but crop to bar area
    output_ctx.drawImage(
      Optimized ? this.temp_canvas : this.shadow_canvas,
      // Same source-dest regions
      bar_left, 0, bar_width, h,
      bar_left, 0, bar_width, h
    );
  }

  render() {
    const {x, y, w, h, Optimized} = this.props;

    return (
      <div className='GradMeterWrapper' style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h
      }}>
        <canvas ref={this.canvasRef} width={w} height={h} style={{
          imageRendering: "pixelated",
        }} />
        <canvas ref={this.tempCanvasRef} width={w} height={h} style={{
          display: "none"
        }} />
        {!Optimized && (<canvas ref={this.shadowCanvasRef} width={w} height={h} style={{
          display: "none"
        }} />)}
        { this.getTicks() }
      </div>
    )
  }
}

export default GradMeter