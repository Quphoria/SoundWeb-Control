var numberFormatter = require("number-formatter");

var stateVariables = [];

const int = (n) => Math.round(n);

const dToGain = (svValue) => svValue >= -100000 ? svValue / 10000.0 : -10.0 * Math.pow(10.0, Math.abs((svValue - -100000.0) / 200000.0));
const lFromGain = (dValue) => int(dValue < -10.0 ? (-Math.log10(Math.abs(dValue / 10.0)) * 200000.0) - 100000 : (dValue * 10000.0));
const dToScalar = (svValue) => svValue / 10000.0;
const lFromScalar = (dValue) => int(dValue * 10000.0);
const dToDiscrete = (svValue) => svValue;
const lFromDiscrete = (dValue) => int(dValue);
const dToLog = (svValue) => Math.pow(10.0, svValue / 1000000.0);
const lFromLog = (dValue) => int(dValue <= 0.0 ? int.MinValue : (Math.log10(dValue) * 1000000.0));
const dToSpeed = (svValue) => Math.pow(10.0, svValue / 1000000.0) / 1000.0;
const lFromSpeed = (dValue) => int(dValue <= 0.0 ? int.MinValue : (Math.log10(dValue * 1000.0) * 1000000.0));
const dToDelay = (svValue) => svValue / 96000.0;
const lFromDelay = (dValue) => int(Math.round(dValue * 96000.0));
const dToInputGain = (lVal) => lVal * 6.0;
const lFromInputGain = (dVal) => int(dVal / 6.0);
const dToFreeCycles = (lVal) => (1000 + lVal) / 10.0;
const lFromFreeCycles = (dVal) => int((dVal * 10.0) - 1000);
const dFromFrequency = (dValue) => Math.log10(dValue) * 1000000.0;
const dToCrownGain = (svValue) => svValue / 2.0 - 100.0;
const lFromCrownGain = (dValue) => int((dValue + 100.0) * 2.0);
const dToCrownGainLong = (svValue) => svValue / 128.0 - 256.0;
const lFromCrownGainLong = (dValue) => int((dValue + 256.0) * 128.0);
const dToTemp = (svValue) => svValue / 100.0;
const lFromTemp = (dValue) => int(dValue * 100.0);
const dToFloat = (svValue) => svValue / 16777216.0;
const lFromFloat = (dValue) => int(dValue * 16777216.0);

const DP_AUTO = -1;
const INF_SYMBOL = '∞';
const MICRO_SYMBOL = 'µ';
const DEG_SYMBOL = 'º';
const DEFAULT_MULTIPLIER = 10000;
const VALUE_OFF = 0;
const VALUE_ON = 1;
const COMPRESSORTHRESHOLD_MAX = 200000;
const strInf = '∞';
const strMinusInf = "-∞";
const strRatioInf = "∞:1";
const strus = "µs";
const strDegrees = 'º';
const strDegreesC = "ºC";
const strNotch = "Notch";
const strdB = "dB";
const strdBs = "dB/s";
const strdBu = "dBu";
const strHz = "Hz";
const strkHz = "kHz";
const strOct = " Oct";
const strPercent = "%";
const strs = "s";
const strms = "ms";
const strRatio = ":1";
const strOut = "out";
const _RatioInf = lFromScalar(20.0) + 1; // Ratio lDoubleToSV
const _GainLow = lFromGain(-80.0) + 1; // Gain lDoubleToSV (1 added to make it work)
const SPEED_OF_SOUND = 343.312526556451;
const INCHES_PER_METRE = 39.37007874;
const FEET_PER_METRE = 3.280839895;

const strAttackRelease = ["Fast", "Medium", "Slow", "Dual"];
const strPolarity = ["Normal", "Inverted"];
const strMute = ["Unmuted", "Muted"];
const strSwitch = ["Off", "On"];
const strGate = ["Closed", "Open"];
const strYesNo = ["No", "Yes"];
const strOnline = ["Offline", "Pending", "Online"];

const isDigit = (c) => /^\d$/.test(c);
const DECIBELS_OUT = () => 0;
// To binary has been altered from (dValue != 0.0) so negative numbers appear as 0
const TO_BINARY = (str, strValue, dValue) => strValue.includes(str[1]) || dValue > 0 ? 1 : 0;
const BOOST_LOW = () => -150000;
const NOTCH_LOW = () => BOOST_LOW() - 1;
const ulStringToIP = (strIP) => {
  // One of the ip calculations is wrong
  // This other calculation has been changed to reflect the other (order of a-d reversed) (this could be incorrect but I am unable to test this atm)
  var ip = 0;
  for (var index = 0; index < 4; ++index) {
    length = strIP.indexOf('.');
    var str;
    if (length != -1)
    {
      str = strIP.slice(0, length);
      strIP = strIP.slice(length + 1);
    } else
      str = strIP;
    var num = parseInt(str);
    if (num > 0xff)
      num = 0xff;
    ip = (ip << 8) + num;
  }
  return ip;
};
const DateTimeStringToSv = (dateTime) => {
  var result = Date.parse(dateTime);
  if (result == NaN) return 0;
  return result / 1000; // Datetime code seems to handle seconds since 1/1/1970
};
const CUSTOM_FORMAT = (VAL, nDecimalPlaces) => {
  var format = "0";
  if (nDecimalPlaces > 0) {
    format += "." + Array(nDecimalPlaces).join("#");
  }
  return numberFormatter(format, VAL);
};
const FORMAT_VALUE = (AUTO, VAL, nDecimalPlaces) => nDecimalPlaces != -1 ? CUSTOM_FORMAT(VAL, nDecimalPlaces) : numberFormatter(AUTO, VAL);

class StateVariable {
  static CardInputGain = new StateVariable(138, "CardInputGain", dToInputGain, lFromInputGain);
  static CM1FreeCycles = new StateVariable(911, "CM1FreeCycles", dToFreeCycles, lFromFreeCycles);
  static CompressorThreshold = new StateVariable(118, "CompressorThreshold", dToScalar, lFromScalar);
  static Decibels = new StateVariable(107, "Decibels", dToScalar, lFromScalar, -800000, 400000);
  static DecibelsOut = new StateVariable(109, "DecibelsOut", dToScalar, lFromScalar, -800000, 400000);
  static Delay = new StateVariable(117, "Delay", dToDelay, lFromDelay);
  static FilterWidth = new StateVariable(125, "FilterWidth", dToScalar, lFromScalar);
  static Float = new StateVariable(907, "Float", dToFloat, lFromFloat);
  static Frequency = new StateVariable(121, "Frequency", dToLog, lFromLog);
  static Gain = new StateVariable(106, "Gain", dToGain, lFromGain, _GainLow, lFromGain(10));
  static Level = new StateVariable(110, "Level", dToScalar, lFromScalar);
  static MatrixGain = new StateVariable(133, "MatrixGain", dToScalar, lFromScalar);
  static Notch = new StateVariable(126, "Notch", dToScalar, lFromScalar);
  static Pan = new StateVariable(134, "Pan", dToScalar, lFromScalar);
  static Percentage = new StateVariable(122, "Percentage", dToScalar, lFromScalar);
  static Phase = new StateVariable(127, "Phase", dToScalar, lFromScalar);
  static Ratio = new StateVariable(119, "Ratio", dToScalar, lFromScalar);
  static Speed = new StateVariable(131, "Speed", dToSpeed, lFromSpeed);
  static Temperature = new StateVariable(915, "Temperature", dToTemp, lFromTemp);
  static Byte = new StateVariable(901, "Byte", dToDiscrete, lFromDiscrete);
  static CrossoverFilter = new StateVariable(132, "CrossoverFilter", dToDiscrete, lFromDiscrete);
  static Discrete = new StateVariable(105, "Discrete", dToDiscrete, lFromDiscrete);
  static ExpanderRatio = new StateVariable(130, "ExpanderRatio", dToDiscrete, lFromDiscrete);
  static FilterShape = new StateVariable(120, "FilterShape", dToDiscrete, lFromDiscrete);
  static FilterSlope = new StateVariable(124, "FilterSlope", dToDiscrete, lFromDiscrete);
  static FreeMemory = new StateVariable(912, "FreeMemory", dToDiscrete, lFromDiscrete);
  static Gate = new StateVariable(114, "Gate", dToDiscrete, lFromDiscrete);
  static IPAddress = new StateVariable(136, "IPAddress", dToDiscrete, lFromDiscrete);
  static Long = new StateVariable(905, "Long", dToDiscrete, lFromDiscrete);
  static Mute = new StateVariable(111, "Mute", dToDiscrete, lFromDiscrete);
  static NoiseType = new StateVariable(129, "NoiseType", dToDiscrete, lFromDiscrete);
  static Online = new StateVariable(115, "Online", dToDiscrete, lFromDiscrete);
  static PEQFilter = new StateVariable(123, "PEQFilter", dToDiscrete, lFromDiscrete);
  static Polarity = new StateVariable(112, "Polarity", dToDiscrete, lFromDiscrete);
  static RangedPercentage = new StateVariable(135, "RangedPercentage", dToDiscrete, lFromDiscrete);
  static Seconds = new StateVariable(900, "Seconds", dToDiscrete, lFromDiscrete);
  static SignedByte = new StateVariable(902, "SignedByte", dToDiscrete, lFromDiscrete);
  static SignedWord = new StateVariable(903, "SignedWord", dToDiscrete, lFromDiscrete);
  static Source = new StateVariable(128, "Source", dToDiscrete, lFromDiscrete);
  static Switch = new StateVariable(113, "Switch", dToDiscrete, lFromDiscrete);
  static UnsignedLong = new StateVariable(906, "UnsignedLong", dToDiscrete, lFromDiscrete);
  static Word = new StateVariable(904, "Word", dToDiscrete, lFromDiscrete);
  static YesNo = new StateVariable(116, "YesNo", dToDiscrete, lFromDiscrete);

  // Default values
  static Unknown = new StateVariable(104, "Unknown");
  static FixedPointDecibels = new StateVariable(108, "FixedPointDecibels");
  static RealTimeClock = new StateVariable(137, "RealTimeClock");
  static CM1Int24 = new StateVariable(139, "CM1Int24");
  static CM1Int24Sens = new StateVariable(140, "CM1Int24Sens");
  static String = new StateVariable(908, "String");
  static Hex = new StateVariable(909, "Hex");
  static Hex8 = new StateVariable(910, "Hex8");
  static TimeSpan = new StateVariable(913, "TimeSpan");
  static PercentageControl = new StateVariable(914, "PercentageControl");
  static LevelPerSec = new StateVariable(916, "LevelPerSec");
  static WordFloat = new StateVariable(917, "WordFloat");
  static SignalNaming = new StateVariable(918, "SignalNaming");
  static NamingOverride = new StateVariable(919, "NamingOverride");
  static ChannelSignalNaming = new StateVariable(920, "ChannelSignalNaming");
  static UserCustom = new StateVariable(921, "UserCustom");
  static DialNumberString = new StateVariable(922, "DialNumberString");
  
  constructor(id, type, toMethod=dToDiscrete, fromMethod=lFromDiscrete, min=-0x80000000, max=0x7fffffff) {
    this.id = id;
    this.type = type;
    this.dSVToDouble = toMethod;
    this.lDoubleToSV = fromMethod;
    this.min = min;
    this.max = max;
    if (id != 104) { // Unknown
      stateVariables.push(this);
    }
  }
  toString() {
    return `StateVariable.${this.type}`;
  }
  lStringToSV(strValue) {
    var o = strValue.toLowerCase();
    var dValue = 0;
    if (o.includes('∞') || o.includes(strOut) || o.includes("notch") || o.includes("inf")) {
      dValue = 0;
    } else {
      for (var i = strValue.length - 1; i >= 0; --i) {
        var c = strValue[i];
        if (!isDigit(c) && c != "-" && c != '.' && c != ',')
          o = o.slice(0, i) + o.slice(i+1);
      }
      if (o != "")
        dValue = parseFloat(o);
    }
    if (strValue.includes("k"))
      dValue *= 1000;
      var sv;
    switch (this.id) {
      case StateVariable.Gain.id:
        sv = o.includes("-inf") || o.includes(strMinusInf) ? _GainLow : this.lDoubleToSV(dValue);
        break;
      case StateVariable.DecibelsOut.id:
        sv = !o.includes(strOut) ? this.lDoubleToSV(dValue) : DECIBELS_OUT();
        break;
      case StateVariable.Mute.id:
        sv = TO_BINARY(strMute, strValue, dValue);
        break;
      case StateVariable.Polarity.id:
        sv = TO_BINARY(strPolarity, strValue, dValue);
        break;
      case StateVariable.Switch.id:
        sv = TO_BINARY(strSwitch, strValue, dValue);
        break;
      case StateVariable.Gate.id:
        sv = TO_BINARY(strGate, strValue, dValue);
        break;
      case StateVariable.Online.id:
        sv = TO_BINARY(strOnline, strValue, dValue);
        break;
      case StateVariable.YesNo.id:
        sv = TO_BINARY(strYesNo, strValue, dValue);
        break;
      case StateVariable.Delay.id:
      case StateVariable.Speed.id:
        if (strValue.includes(strus) || strValue.includes("u") || strValue.includes("U"))
          dValue /= 1000000.0;
        else if (strValue.includes("m") || strValue.includes("M"))
          dValue /= 1000.0;
        sv = this.lDoubleToSV(dValue);
        break;
      case StateVariable.CompressorThreshold.id:
        sv = o.includes("inf") || o.includes(strInf) ? 200000 : this.lDoubleToSV(dValue);
        break;
      case StateVariable.Ratio.id:
        sv = o.includes("inf") || o.includes(strInf) ? _RatioInf : this.lDoubleToSV(dValue);
        break;
      case StateVariable.Percentage.id:
        sv = this.lDoubleToSV(dValue / 100.0);
        break;
      case StateVariable.Notch.id:
        sv = !o.includes("notch") ? this.lDoubleToSV(dValue) : NOTCH_LOW();
        break;
      case StateVariable.Pan.id:
        sv = strValue.includes("L") || strValue.includes("l") ? (strValue.length != 1 ? this.lDoubleToSV(0.5 - dValue / 200.0) : 0) : (strValue.includes("R") || strValue.includes("r") ? (strValue.length != 1 ? this.lDoubleToSV(0.5 + dValue / 200.0) : 9999) : 5000);
        break;
      case StateVariable.IPAddress.id:
        sv = ulStringToIP(strValue);
        break;
      case StateVariable.RealTimeClock.id:
        sv = DateTimeStringToSv(strValue);
        break;
      case StateVariable.Seconds.id:
        var num1 = 0;
        var str = strValue;
        if (str.includes("M") || str.includes("m") || str.includes(":"))
        {
          var num2 = 0;
          var flag = false;
          while (!flag && str[num2] != 'M' && str[num2] != 'm' && str[num2] != ':')
            ++num2;
          num1 = parseInt(str.slice(0, num2));
          str = str.slice(num2 + 1);
        }
        var int32 = parseInt(str);
        sv = num1 * 60 + int32;
        break;
      case StateVariable.Byte.id:
      case StateVariable.SignedByte.id:
      case StateVariable.SignedWord.id:
      case StateVariable.Word.id:
      case StateVariable.Long.id:
      case StateVariable.FreeMemory.id:
        sv = parseInt(strValue);
        break;
      case StateVariable.UnsignedLong.id:
      case StateVariable.Hex.id:
      case StateVariable.Hex8.id:
        sv = dValue >= 0.0 ? parseInt(strValue) : 0;
        break;
      case StateVariable.LevelPerSec.id:
        sv = this.lDoubleToSV(dValue * 100.0);
        break;
      default:
        sv = this.lDoubleToSV(dValue);
        break;
    }
    return sv;
  }
  CustomFormat(EXT, svValue, nDecimalPlaces, bShort, Format) {
    var VAL = this.dSVToDouble(svValue);
    var str = FORMAT_VALUE(Format, VAL, nDecimalPlaces);
    if (!bShort)
      str += EXT;
    return str;
  }
  CustomFormatPlus(EXT, svValue, nDecimalPlaces, bShort, Format) {
    var num = this.dSVToDouble(svValue);
    var str = this.CustomFormat(EXT, svValue, nDecimalPlaces, bShort, Format);
    if (num > 0.0)
      str = "+" + str;
    return str;
  }
  STANDARD_FORMAT2(EXT, svValue, nDecimalPlaces, bShort) {
    var str = FORMAT_VALUE("0.##", this.dSVToDouble(svValue), nDecimalPlaces); // F2
    if (!bShort)
      str += EXT;
    return str;
  }
  MUL_FORMAT2(EXT, MUL, svValue, nDecimalPlaces, bShort) {
    var str = FORMAT_VALUE("0.##", this.dSVToDouble(svValue) * MUL, nDecimalPlaces);
    if (!bShort)
      str += EXT;
    return str;
  }
  // bShort hides the units if true
  vSVToString(svValue, bShort, nDecimalPlaces, Format=null) {
    var strAES = "";
    Format = Format === null ? "0.##" : Format;
    switch (this.id) {
      case StateVariable.Discrete.id:
        strAES = svValue.toString();
        break;
      case StateVariable.Gain.id:
        if (svValue <= _GainLow)
        {
          strAES = strMinusInf;
          if (bShort)
            break;
          strAES += strdB;
          break;
        }
        strAES = this.CustomFormatPlus(strdB, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.Decibels.id:
      case StateVariable.CardInputGain.id:
        strAES = this.CustomFormatPlus(strdB, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.DecibelsOut.id:
        if (svValue == DECIBELS_OUT())
        {
          strAES = strOut;
          break;
        }
        strAES = this.CustomFormatPlus(strdB, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.Level.id:
        strAES = this.CustomFormatPlus(strdBu, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.Mute.id:
        strAES = strMute[svValue];
        break;
      case StateVariable.Polarity.id:
        strAES = strPolarity[svValue];
        break;
      case StateVariable.Switch.id:
        strAES = strSwitch[svValue];
        break;
      case StateVariable.Gate.id:
        strAES = strGate[svValue];
        break;
      case StateVariable.Online.id:
        strAES = strOnline[svValue];
        break;
      case StateVariable.YesNo.id:
        strAES = strYesNo[svValue];
        break;
      case StateVariable.Delay.id:
        VAL1 = this.dSVToDouble(svValue) * 1000.0;
        strAES = FORMAT_VALUE("0.###", VAL1, nDecimalPlaces); // F3
        if (bShort)
          break;
        strAES += strms;
        break;
      case StateVariable.CompressorThreshold.id:
        if (svValue == 200000)
        {
          strAES = strInf;
          if (bShort)
            break;
          strAES += strdBu;
          break;
        }
        strAES = this.CustomFormat(strdBu, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.Ratio.id:
        if (svValue == _RatioInf)
        {
          if (bShort)
          {
            strAES = strInf;
            break;
          }
          strAES = strRatioInf;
          break;
        }
        strAES = this.STANDARD_FORMAT2(strRatio, svValue, nDecimalPlaces, bShort);
        break;
      case StateVariable.Frequency.id:
        var VAL2 = this.dSVToDouble(svValue);
        nDecimalPlaces = -1;
        if (VAL2 >= 1000.0)
        {
          strAES = VAL2 < 10000.0 ? FORMAT_VALUE("0.##", VAL2 / 1000.0, nDecimalPlaces) : FORMAT_VALUE("0.#", VAL2 / 1000.0, nDecimalPlaces);
          if (bShort)
          {
            strAES += "k";
            break;
          }
          strAES += strkHz;
          break;
        }
        strAES = VAL2 < 100.0 ? FORMAT_VALUE("0.#", VAL2, nDecimalPlaces) : FORMAT_VALUE("0", VAL2, nDecimalPlaces);
        if (bShort)
          break;
        strAES += strHz;
        break;
      case StateVariable.Percentage.id:
        strAES = this.MUL_FORMAT2(strPercent, 100.0, svValue, 0, bShort);
        strAES += strPercent;
        break;
      case StateVariable.FilterWidth.id:
        strAES = this.CustomFormat(strOct, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.Notch.id:
        if (svValue == NOTCH_LOW())
        {
          strAES = strNotch;
          break;
        }
        strAES = this.CustomFormatPlus(strdB, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.Phase.id:
        strAES = this.CustomFormat(strDegrees, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.Speed.id:
        var VAL3 = this.dSVToDouble(svValue);
        if (VAL3 < 0.001)
        {
          var VAL4 = VAL3 * 1000000.0;
          strAES = FORMAT_VALUE(Format, VAL4, nDecimalPlaces);
          strAES += strus;
          break;
        }
        if (VAL3 < 1.0)
        {
          var VAL5 = VAL3 * 1000.0;
          strAES = FORMAT_VALUE(Format, VAL5, nDecimalPlaces);
          strAES += strms;
          break;
        }
        strAES = FORMAT_VALUE(Format, VAL3, nDecimalPlaces);
        strAES += strs;
        break;
      case StateVariable.Pan.id:
        if (svValue == 5000)
        {
          if (bShort)
          {
            strAES = "C";
            break;
          }
          strAES = "Centre";
          break;
        }
        if (svValue < 5000)
        {
          if (bShort && svValue == 0)
          {
            strAES = "L";
            break;
          }
          strAES = FORMAT_VALUE(Format, (0.5 - this.dSVToDouble(svValue)) * 200.0, nDecimalPlaces);
          strAES += "L";
          break;
        }
        if (bShort && svValue == 10000)
        {
          strAES = "R";
          break;
        }
        strAES = FORMAT_VALUE(Format, (this.dSVToDouble(svValue) - 0.5) * 200.0, nDecimalPlaces);
        strAES += "R";
        break;
      case StateVariable.IPAddress.id:
        // One of the ip calculations is wrong
        // This one has been changed to reflect the other (order of a-d reversed) (this could be incorrect but I am unable to test this atm)
        const a = (svValue >> 24) & 0xff;
        const b = (svValue >> 16) & 0xff;
        const c = (svValue >> 8) & 0xff;
        const d = svValue & 0xff;
        strAES = a.toString() + "." + b.toString() + "." + c.toString() + "." + d.toString();
        break;
      case StateVariable.RealTimeClock.id:
        // Convert seconds to milliseconds since 1970
        var localTime = new Date(svValue * 1000)
        strAES = localTime.toLocaleString();
        // Expected (localTime):
        // dddd, MMMM dd, yyyy h:mm:ss tt
        // Example: Monday, May 28, 2012 11:35:00 AM
        break;
      case StateVariable.Seconds.id:
        var num1 = svValue / 60;
        var num2 = svValue % 60;
        if (bShort)
        {
          if (num1 == 0)
          {
            strAES = num2.toString() + "s";
            break;
          }
          if (num2 == 0)
          {
            strAES = num1.toString() + "m";
            break;
          }
          strAES = (num1 * 60 + num2).toString() + "s";
          break;
        }
        if (num1 > 0)
        {
          if (num2 > 0)
          {
            strAES = num1.toString() + "m " + num2.toString() + "s";
            break;
          }
          if (num1 == 1)
          {
            strAES = num1.toString() + "min";
            break;
          }
          strAES = num1.toString() + "mins";
          break;
        }
        strAES = num2.toString() + "secs";
        break;
      case StateVariable.Byte.id:
      case StateVariable.Word.id:
      case StateVariable.UnsignedLong.id:
        // JS Hack to convert to uint32
        strAES = (svValue>>>0).toString();
        break;
      case StateVariable.SignedByte.id:
      case StateVariable.SignedWord.id:
      case StateVariable.Long.id:
        strAES = svValue.toString();
        break;
      case StateVariable.Float.id:
        var num3 = this.dSVToDouble(svValue);
        // {0,4:F} (default for F is F2) (the 0 is the arg position so the format is 4:F)
        strAES = numberFormatter( "#,##0.##", num3);
        break;
      case StateVariable.Hex.id:
        // strAES = string.Format("0x{0:X}", (object) (uint) svValue);
        strAES = "0x" + svValue.toString(16);
        break;
      case StateVariable.Hex8.id:
        // strAES = string.Format("0x{0,8:X}", (object) (uint) svValue);
        strAES = "0x" + svValue.toString(16);
        break;
      case StateVariable.CM1FreeCycles.id:
        strAES = this.CustomFormat(strPercent, svValue, nDecimalPlaces, bShort, "0.#");
        break;
      case StateVariable.FreeMemory.id:
        strAES = (svValue >> 10).toString() + "KB";
        break;
      case StateVariable.Temperature.id:
        strAES = this.CustomFormat(strDegreesC, svValue, nDecimalPlaces, bShort, Format);
        break;
      case StateVariable.LevelPerSec.id:
        var num4 = this.dSVToDouble(svValue);
        strAES = FORMAT_VALUE(Format, num4 / 100.0, 2);
        strAES += strdBs;
        break;
      case StateVariable.RangedPercentage.id:
        strAES = svValue.toString();
        strAES += strPercent;
        break;
      default:
        strAES = svValue.toString();
        break;
    }
    return strAES;
  }

  getPercentage(svValue) {
    // switch (this.id) {
    //   case StateVariable.Gain.id:
    //   case StateVariable.Frequency.id:
    //   case StateVariable.Speed.id:
    //     console.log(this.max, Math.log10(this.max));
    //     console.log(this.min, Math.log10(this.min));
    //     return (Math.log10(svValue) - Math.log10(this.min)) / (Math.log10(this.max) - Math.log10(this.min));
    //   case StateVariable.Decibels.id:
    //   case StateVariable.DecibelsOut.id:
    //   default:
    //     return (svValue - this.min) / (this.max - this.min);
    // }
    return (svValue - this.min) / (this.max - this.min);
  }

  fromPercentage(pValue) {
    return this.min + pValue*(this.max - this.min);
  }
}

function getSV(classID) {
  const id = parseInt(classID);
  for (var sv of stateVariables) {
    if (sv.id == id) {
      return sv
    }
  }
  return StateVariable.Unknown;
}

export default getSV