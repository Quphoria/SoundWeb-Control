import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import List
import html, json
import traceback

pages = 0
tabsize = 2

def parse_alignment(s):
    v_aligns = ["Top", "Middle", "Bottom"]
    h_aligns = ["Left", "Center", "Right"]
    v_align = next((a for a in v_aligns if a in s), "Middle")
    h_align = next((a for a in h_aligns if a in s), "Center")
    return v_align, h_align

def param_str(node, v_device, obj_id, param_id):
    return format(node, '04x') + ":" + format(v_device, '02x') + ":" + format(obj_id, '06x') + ":" + format(param_id, '04x')

system_colours = {
    "ActiveBorder": "#b4b4b4",
    "ActiveCaption": "#99b4d1",
    "ActiveCaptionText": "#000000",
    "AppWorkspace": "#ababab",
    "Control": "#f0f0f0",
    "ControlDark": "#a0a0a0",
    "ControlDarkDark": "#696969",
    "ControlLight": "#e3e3e3",
    "ControlLightLight": "#e3e3e3",
    "ControlText": "#000000",
    "Desktop": "#000000",
    "GrayText": "#6d6d6d",
    "Highlight": "#0078d7",
    "HighlightText": "#ffffff",
    "HotTrack": "#0066cc",
    "InactiveBorder": "#f4f7fc",
    "InactiveCaption": "#bfcddb",
    "InactiveCaptionText": "#000000",
    "Info": "#ffffe1",
    "InfoText": "#000000",
    "Menu": "#f0f0f0",
    "MenuText": "#000000",
    "ScrollBar": "#c8c8c8",
    "Window": "#ffffff",
    "WindowFrame": "#646464",
    "WindowText": "#000000"
}

def parse_rgb(colour: str):
    if colour is None:
        return colour
    if colour in system_colours:
        return system_colours[colour]
    if colour.count(",") == 2:
        return "rgb(" + colour + ")"
    return colour

def format_font(font_str):
    font_arr = font_str.replace("style=", "").split(",")[::-1]
    return " ".join(font_arr) + ", sans-serif" # default to sans-serif font if font unavailable

border_style = {
    "RaisedOuter": "outset",
    "SunkenOuter": "inset",
    "RaisedInner": "ridge",
    "SunkenInner": "groove",
    "Raised": "outset",
    "Etched": "inset",
    "Bump": "ridge",
    "Sunken": "inset",
    "Adjust": "solid",
    "Flat": "solid"
}

@dataclass
class XY:
    x: int
    y: int
    
    @classmethod
    def parse(cls, s):
        x, y = s.split(",", 1)
        return cls(int(x), int(y))

    def __sub__(self, a):
        return XY(self.x - a.x, self.y - a.y)

@dataclass
class Control:
    component = "Control"
    ctype: str
    depth: int
    tab_depth: int
    attribs: dict[str, str]
    contents: List['Control'] = field(default_factory=list)
    
    def subControls(self):
        return self.contents

    def format_attribs(self) -> str:
        s = ""
        try:
            for attrib, value in self.attribs.items():
                s += attrib + "="
                if type(value) == str:
                    s += '"' + html.escape(value) + '"'
                elif type(value) == int or type(value) == float:
                    s += "{" + str(value) + "}"
                elif type(value) == list or type(value) == dict:
                    s += "{" + json.dumps(value) + "}"
                elif type(value) == bool:
                    s += "{"
                    if value:
                        s += "true"
                    else:
                        s += "false"
                    s += "}"
                else:
                    assert False, "Unexpected attribute type: " + value.__class__.__name__
                s += " "
        except Exception as ex:
            error_msg = type(ex).__name__ + " error while parsing attribute in: " + self.name
            raise Exception(error_msg)
        return s

    def __str__(self) -> str:
        padding = " "*tabsize*self.depth
        s = padding + "<" + self.component + " "
        s += self.format_attribs()
        subcontrols = self.subControls()
        if len(subcontrols) == 0:
            s += "/>\n"
        else:
            s += ">\n"
            s += "".join((str(sc) for sc in subcontrols))
            if len(subcontrols) > 0 and type(subcontrols[-1]) == str:
                s += "\n"
            s += padding + "</" + self.component + ">\n"
        return s


    def __post_init__(self):
        self.name = self.attribs["Name"]

    @classmethod
    def parse(cls, Control, *, depth, tab_depth, **kwargs):
        ctype = Control.attrib.get("Type", None)
        Location = XY.parse(Control.attrib.get("Location", "0,0"))
        Size = XY.parse(Control.attrib.get("Size", "0,0"))

        attribs = {}
        attribs["Name"] = Control.attrib.get("Name", "")
        attribs["x"] = Location.x
        attribs["y"] = Location.y
        attribs["w"] = Size.x
        attribs["h"] = Size.y
        attribs["BackColor"] = parse_rgb(Control.attrib.get("BackColor", "Transparent"))
        attribs["ForeColor"] = parse_rgb(Control.attrib.get("ForeColor", "White"))
        attribs["font"] = format_font(Control.attrib.get("Font", "inherit"))
        attribs["text"] = Control.attrib.get("Text", "")
        attribs["Thickness"] = int(Control.attrib.get("Thickness", "1"))
        return cls(ctype, depth, tab_depth, attribs)

@dataclass
class TabPage(Control):
    component = "TabBackground"
    page_number: int = 0

    @classmethod
    def parse(cls, Control, *, depth, tab_depth, page_number, tabSize, **kwargs):
        c = super().parse(Control, depth=depth, tab_depth=tab_depth, **kwargs)
        c.page_number = page_number
        c.attribs["w"] = tabSize.x
        c.attribs["h"] = tabSize.y

        c.attribs["font"] = format_font(Control.attrib.get("TabFont", "Microsoft Sans Serif, 8pt"))
        c.attribs["TabBackColor"] = parse_rgb(Control.attrib.get("TabBackColor", "Black"))
        c.attribs["TabForeColor"] = parse_rgb(Control.attrib.get("TabForeColor", "White"))
        subcontrols = Control.find("Controls", None)
        if subcontrols is not None:
            for subcontrol in subcontrols.findall("Control"):
                sc = parse_control(subcontrol, depth=depth+1, tab_depth=tab_depth+1, **kwargs)
                if sc is not None:
                    c.contents.append(sc)
        # assert False, "Parse Not Implemented: " + cls.__name__
        return c

@dataclass
class TabPanel(Control):
    component = "TabContainer"
    tabPages: List[TabPage] = None
    TabSize: XY = None
    TabBodySize: XY = None

    def subControls(self):
        return self.tabPages

    def __str__(self) -> str:
        padding = " "*tabsize*self.depth
        padding2 = " "*tabsize*(self.depth+1)
        padding3 = " "*tabsize*(self.depth+2)
        padding4 = " "*tabsize*(self.depth+3)
        s = padding + "<" + self.component + " "
        s += self.format_attribs()
        subcontrols = self.subControls()
        if len(subcontrols) == 0:
            s += "/>\n"
        else:
            s += ">\n"
            s += padding2 + "<TabHead>\n"

            for n in range(len(subcontrols)):
                if self.tab_depth == 0:
                    s += padding3 + "{!(hiddenTabs && hiddenTabs.includes('" + str(n) + "')) && (\n"
                s += padding3 + "<TabButton "
                if self.tab_depth == 0:
                    s += "tab_number=\"" + str(n) + "\" "
                    s += "is_selected={selected_tab == \"" + str(n) + "\"} pathname={pathname} "
                else:
                    s += "isSubtab={true} tab_number={" + str(n) + "} depth={" + str(self.tab_depth-1) + "} "
                    s += "set_function={setSubtab} is_selected={getSubtab(subtab, " + str(self.tab_depth-1) + ") == " + str(n) + "} "
                s += "name=\""
                if "text" in subcontrols[n].attribs:
                    s += html.escape(subcontrols[n].attribs["text"])
                else:
                    s += "Tab " + str(n)
                s += "\" "
                s += "width={" + str(self.attribs["TabSizeW"]) + "} "
                s += "height={" + str(self.attribs["TabSizeH"]) + "} "
                s += "colour=\""
                if "ForeColor" in subcontrols[n].attribs:
                    s += subcontrols[n].attribs["TabForeColor"]
                else:
                    s += "white"
                s += "\" backColour=\""
                if "BackColor" in subcontrols[n].attribs:
                    s += subcontrols[n].attribs["TabBackColor"]
                else:
                    s += "black"
                s += "\" font=\""
                if "font" in subcontrols[n].attribs:
                    s += subcontrols[n].attribs["font"]
                else:
                    s += "inherit"
                s += "\" />\n"
                if self.tab_depth == 0:
                    s += padding3 + ")}\n"
            s += padding2 + "</TabHead>\n"
            # remove 1px padding from height
            s += padding2 + "<TabBody style={{height: 'calc(100% - 1px - " + str(self.TabSize.y) + "px)'}}>\n"
            # s += padding2 + "<TabBody>\n"

            for n in range(len(subcontrols)):
                if self.tab_depth == 0:
                    s += padding3 + "{!(hiddenTabs && hiddenTabs.includes('" + str(n) + "')) && (\n"
                s += padding3 + "<div style={"
                if self.tab_depth == 0:
                    s += "selected_tab == \"" + str(n) + "\""
                else:
                    s += "getSubtab(subtab, " + str(self.tab_depth-1) + ") == " + str(n)
                s += " ? {}: {display: \"none\"}}>\n"
                s += padding4 + "<ControlWrapper>\n"
                s += str(subcontrols[n])

                s += padding4 + "</ControlWrapper>\n"
                s += padding3 + "</div>\n"
                if self.tab_depth == 0:
                    s += padding3 + ")}\n"

            s += padding2 + "</TabBody>\n"
            s += padding + "</" + self.component + ">\n"
        return s
    
    @classmethod
    def parse(cls, Control, *, depth, tab_depth, tab, **kwargs):
        global pages
        c = super().parse(Control, depth=depth, tab_depth=tab_depth, tab=tab, **kwargs)
        c.tabPages = []
        Size = XY.parse(Control.attrib.get("Size", "0,0"))
        c.TabSize = XY.parse(Control.attrib.get("TabSize", "0,0"))
        c.TabBodySize = Size - XY(0, c.TabSize.y) 
        tp = Control.find("TabPages")
        if tp is not None:
            for i, page in enumerate(tp.findall("TabPage")):
                # Audio Architect seems to add 4px margin on tab body
                UsableTabBodySize = c.TabBodySize  - XY(8, 8)
                c.tabPages.append(TabPage.parse(
                    page,
                    depth=depth+4,
                    tab_depth=tab_depth,
                    tab=(i if tab is None else tab),
                    page_number=i,
                    tabSize=UsableTabBodySize,
                    **kwargs
                ))
        c.attribs["TabSizeW"] = c.TabSize.x
        c.attribs["TabSizeH"] = c.TabSize.y
        if tab_depth == 0:
            pages = len(c.tabPages)
        return c

@dataclass
class TextControl(Control):
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        c.attribs["VAlign"] = "Middle"
        c.attribs["HAlign"] = "Center"
        properties = Control.find("ControlProperties")
        if properties is not None:
            alignment = properties.find("Alignment")
            if alignment is not None:
                va, ha = parse_alignment(alignment.text)
                c.attribs["VAlign"] = va
                c.attribs["HAlign"] = ha
        return c

@dataclass
class Annotation(TextControl):
    component = "Label"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        comp_props = Control.find('.//ComplexProperties[@Tag="HProAnnotation"]')
        assert comp_props, "Annotation " + c.name + " Missing HProAnnotation ComplexProperties"
        textlines = comp_props.find("TextLines")
        assert textlines, "Annotation " + c.name + " Missing TextLines"
        text = "<br/>".join([line.text for line in textlines.findall("Line")])
        c.contents.append(text)
        properties = Control.find("ControlProperties")
        if properties is not None:
            BorderColor = properties.find("BorderColor")
            if BorderColor is not None:
                c.attribs["BorderColor"] = parse_rgb(BorderColor.text)
            BorderStyle = properties.find("Border")
            if BorderStyle is not None:
                c.attribs["borderStyle"] = border_style[BorderStyle.text]
        return c

@dataclass
class ParameterControl(Control):
    @classmethod
    def parse(cls, Control, *, tab, **kwargs):
        c = super().parse(Control, tab=tab, **kwargs)
        comp_props = Control.find('.//ComplexProperties[@Tag="HProSVControl"]')
        assert comp_props, "ParameterControl " + c.name + " Missing HProSVControl ComplexProperties"
        statevariable = comp_props.find("./StateVariableItems/StateVariableItem")
        # assert statevariable != None, "ParameterControl " + c.name + " Missing StateVariableItem"
        if statevariable is not None:
            node = int(statevariable.attrib["NodeID"])
            v_device = int(statevariable.attrib["VdIndex"])
            obj_id = int(statevariable.attrib["ObjID"])
            param_id = int(statevariable.attrib["svID"])
            c.attribs["parameter"] = param_str(node, v_device, obj_id, param_id)
            if tab is not None:
                c.attribs["subscribe_tab"] = tab
            c.attribs["svClass"] = statevariable.attrib["SVClassID"]
        else:
            c.attribs["parameter"] = "none"
        return c

@dataclass
class LED(ParameterControl):
    component = "LED"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        comp_props = Control.find('.//ComplexProperties[@Tag="HProLEDColor"]')
        assert comp_props, "LED " + c.name + " Missing HProLEDColor ComplexProperties"
        min_max_list = comp_props.find("MinMaxList")
        assert min_max_list, "LED " + c.name + " Missing MinMaxList"
        colours = []
        for MinMaxColor in min_max_list.findall("MinMaxColor"):
            colours.append({
                "min": MinMaxColor.attrib["MinString"],
                "max": MinMaxColor.attrib["MaxString"],
                "colour": parse_rgb(MinMaxColor.attrib["Color"])
            })
        c.attribs["colours"] = colours
        return c

@dataclass
class Rectangle(Control):
    component = "Rectangle"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        c.attribs["Thickness"] = int(Control.attrib.get("Thickness", 2))
        c.attribs["Rounded"] = False
        c.attribs["Radius"] = 25
        properties = Control.find("ControlProperties")
        if properties is not None:
            c.attribs["Rounded"] = properties.find("Rounded").text == "True"
            c.attribs["Radius"] = int(properties.find("Radius").text)
        return c
    
@dataclass
class ErrorBox(Control):
    component = "ErrorBox"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        return c

@dataclass
class ParamLabel(ParameterControl):
    component = "ParameterLabel"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        c.attribs["VAlign"] = "Middle"
        c.attribs["HAlign"] = "Center"
        properties = Control.find("ControlProperties")
        if properties is not None:
            alignment = properties.find("Alignment")
            if alignment is not None:
                va, ha = parse_alignment(alignment.text)
                c.attribs["VAlign"] = va
                c.attribs["HAlign"] = ha
            BorderStyle = properties.find("BorderStyle")
            if BorderStyle is not None:
                c.attribs["borderStyle"] = border_style[BorderStyle.text]
        return c

@dataclass
class ComboBox(ParameterControl):
    component = "ComboBox"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        comp_props = Control.find('.//ComplexProperties[@Tag="HProDiscreteControl"]')
        assert comp_props, "ComboBox " + c.name + " Missing HProDiscreteControl ComplexProperties"
        if comp_props.find("SVListOverride") is not None:
            error_msg = f"{c.name} values are from State Variable, unable to resolve names over HiQnet\n"
            error_msg += "Please uncheck 'Label mirrors Value' in the ComboBox value list\n"
            assert False, error_msg + "ComboBox " + c.name + " missing values"
        UserList = comp_props.find("UserList")
        assert UserList != None, "ComboBox " + c.name + " Missing UserList"
        c.attribs["values"] = {}
        for value in UserList.findall("StringList"):
            c.attribs["values"][value.attrib["Value"]] = value.attrib["Label"]
        return c

@dataclass
class OnOffButton(ParameterControl):
    component = "Button"
    @classmethod
    def parse(cls, Control, **kwargs):
        global images
        c = super().parse(Control, **kwargs)
        c.attribs["momentary"] = False
        comp_props = Control.find('.//ComplexProperties[@Tag="HProOnOffButton_1.1"]')
        assert comp_props, "Button " + c.name + " Missing HProDiscreteControl HProOnOffButton_1.1"
        on_item = comp_props.find(".//IndicationItemList/IndicationOnItem")
        off_item = comp_props.find(".//IndicationItemList/IndicationOffItem")
        assert on_item != None, "Button " + c.name + " missing IndicationOnItem"
        assert off_item != None, "Button " + c.name + " missing IndicationOffItem"
        
        c.attribs["onText"] = on_item.attrib["LabelText"]
        c.attribs["onTextColour"] = parse_rgb(on_item.attrib["LabelColor"])
        c.attribs["onColour"] = parse_rgb(on_item.attrib["BackingColor"])
        c.attribs["onImg"] = images[on_item.attrib["Image"]]

        c.attribs["offText"] = off_item.attrib["LabelText"]
        c.attribs["offTextColour"] = parse_rgb(off_item.attrib["LabelColor"])
        c.attribs["offColour"] = parse_rgb(off_item.attrib["BackingColor"])
        c.attribs["offImg"] = images[off_item.attrib["Image"]]

        properties = Control.find("ControlProperties")
        assert properties != None, "Button " + c.name + " Missing Properties"
        OnValue = properties.find("OnValue")
        OffValue = properties.find("OffValue")
        assert OnValue != None, "Button " + c.name + " Missing OnValue"
        assert OffValue != None, "Button " + c.name + " Missing OffValue"
        c.attribs["onValue"] = OnValue.text
        c.attribs["offValue"] = OffValue.text

        return c

@dataclass
class MomentaryButton(OnOffButton):
    component = "Button"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        c.attribs["momentary"] = True
        return c

@dataclass
class SegMeter(ParameterControl):
    component = "SegMeter"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        c.attribs["ticks"] = []
        comp_props = Control.find('.//ComplexProperties[@Tag="CustomScale"]')
        if comp_props is not None:
            for tick in comp_props.findall("Tick"):
                c.attribs["ticks"].append({
                    "pos": float(tick.attrib["Pos"]),
                    "label": tick.attrib["Label"]
                })
        properties = Control.find("ControlProperties")
        if properties is not None:
            c.attribs["scale"] = properties.find("DisplayScale").text == "True"
            c.attribs["scale_left"] = properties.find("ScaleLoc").text == "LEFT_OR_TOP"
            c.attribs["scale_space"] = int(properties.find("ScaleSpace").text)
            c.attribs["TickCount"] = int(properties.find("TickCount").text)
            c.attribs["offColour"] = parse_rgb(properties.find("OffColor").text)
            c.attribs["Sec1Color"] = parse_rgb(properties.find("Sec1Color").text)
            c.attribs["Sec2Color"] = parse_rgb(properties.find("Sec2Color").text)
            c.attribs["Sec3Color"] = parse_rgb(properties.find("Sec3Color").text)
            c.attribs["Sec2Threshold"] = properties.find("Sec2Threshold").text
            c.attribs["Sec3Threshold"] = properties.find("Sec3Threshold").text
            if c.attribs["Sec2Threshold"] is None:
                c.attribs["Sec2Threshold"] = 0.5
            if c.attribs["Sec3Threshold"] is None:
                c.attribs["Sec3Threshold"] = 0.75
            c.attribs["gapSize"] = int(properties.find("SegSpacing").text)
            c.attribs["segments"] = int(properties.find("SegmentCount").text)
            c.attribs["segment_width"] = int(properties.find("SegWidth").text)
        return c
    
@dataclass
class GradMeter(ParameterControl):
    component = "GradMeter"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        c.attribs["ticks"] = []
        comp_props = Control.find('.//ComplexProperties[@Tag="CustomScale"]')
        if comp_props is not None:
            for tick in comp_props.findall("Tick"):
                c.attribs["ticks"].append({
                    "pos": float(tick.attrib["Pos"]),
                    "label": tick.attrib["Label"]
                })
        properties = Control.find("ControlProperties")
        if properties is not None:
            c.attribs["scale"] = properties.find("DisplayScale").text == "True"
            c.attribs["scale_left"] = properties.find("ScaleLoc").text == "LEFT_OR_TOP"
            c.attribs["scale_space"] = int(properties.find("ScaleSpace").text)
            c.attribs["TickCount"] = int(properties.find("TickCount").text)
            c.attribs["BackColor1"] = parse_rgb(properties.find("BackColor1").text)
            c.attribs["BackColor2"] = parse_rgb(properties.find("BackColor2").text)
            c.attribs["LowColor"] = parse_rgb(properties.find("LowColor").text)
            c.attribs["MidColor"] = parse_rgb(properties.find("MidColor").text)
            c.attribs["HighColor"] = parse_rgb(properties.find("HighColor").text)
            c.attribs["MidThreshhold"] = properties.find("MidThreshhold").text
            c.attribs["HighThreshhold"] = properties.find("HighThreshhold").text
            c.attribs["GradFraction"] = float(properties.find("GradFraction").text)
            if c.attribs["MidThreshhold"] is None:
                c.attribs["MidThreshhold"] = 0.5
            if c.attribs["HighThreshhold"] is None:
                c.attribs["HighThreshhold"] = 0.75
            if c.attribs["GradFraction"] is None:
                c.attribs["GradFraction"] = 0.2
        return c

@dataclass
class Fader(ParameterControl):
    component = "Fader"
    @classmethod
    def parse(cls, Control, **kwargs):
        c = super().parse(Control, **kwargs)
        c.attribs["ticks"] = []
        comp_props = Control.find('.//ComplexProperties[@Tag="CustomScale"]')
        if comp_props is not None:
            for tick in comp_props.findall("Tick"):
                c.attribs["ticks"].append({
                    "pos": float(tick.attrib["Pos"]),
                    "label": tick.attrib["Label"]
                })
        properties = Control.find("ControlProperties")
        if properties is not None:
            c.attribs["min"] = properties.find("SVMin").text
            c.attribs["max"] = properties.find("SVMax").text
            c.attribs["trackCenter"] = float(properties.find("ChannelCenter").text)
            c.attribs["trackWidth"] = int(properties.find("ChannelWidth").text)
            c.attribs["trackStart"] = float(properties.find("ChannelStart").text)
            c.attribs["trackEnd"] = float(properties.find("ChannelEnd").text)
            c.attribs["showTicks"] = properties.find("DispTicks").text == "True"
            c.attribs["ticksLeft"] = properties.find("TickLocation").text in ["LeftSide", "BothSides"]
            c.attribs["ticksRight"] = properties.find("TickLocation").text in ["RightSide", "BothSides"]
            c.attribs["TickCount"] = int(properties.find("TickCount").text)
            slidersize = XY.parse(properties.find("SliderSize").text)
            slideroffset = XY.parse(properties.find("SliderBias").text)
            c.attribs["handleWidth"] = slidersize.x
            c.attribs["handleHeight"] = slidersize.y
            c.attribs["capOffsetX"] = slideroffset.x
            c.attribs["capOffsetY"] = slideroffset.y
            c.attribs["vertical"] = properties.find("Orientation").text == "Vertical"
            c.attribs["sliderImg"] = images[properties.find("KnobHandle").text]
            c.attribs["tickColour"] = parse_rgb(properties.find("MajColor").text)
            c.attribs["tickLength"] = int(properties.find("MajLen").text)
            c.attribs["trackColour"] = parse_rgb(properties.find("ChannelColor").text)
            
        return c

@dataclass
class Panel(Control):
    component = "TabBackground"

    @classmethod
    def parse(cls, Control, *, depth, **kwargs):
        c = super().parse(Control, depth=depth, **kwargs)
        for subcontrol in Control.findall("Control"):
            sc = parse_control(subcontrol, depth=depth+1, **kwargs)
            if sc is not None:
                c.contents.append(sc)
        return c

control_types = {
    "HPRO.SDIG.Controls.HProTabControl2": TabPanel,
    "HPRO.SDIG.Controls.HProTabPage2": TabPage,
    "HPRO.SDIG.Controls.HProAnnotation": Annotation,
    "HPRO.SDIG.Controls.HProLEDColor": LED,
    "HPRO.SDIG.GraphicsControls.RectangleGC": Rectangle,
    "HPRO.SDIG.Controls.HProLabel": ParamLabel,
    "HPRO.SDIG.Controls.HProTextBox": ParamLabel,
    "HPRO.SDIG.Controls.HProComboBox": ComboBox,
    "HPRO.SDIG.Controls.HProOnOffButton": OnOffButton,
    "HPRO.SDIG.Controls.HProMomentaryButton": MomentaryButton,
    "HPRO.SDIG.Controls.HProSegMeter": SegMeter,
    "HPRO.SDIG.Controls.HProGradMeter": GradMeter,
    "HPRO.SDIG.Controls.HProSliderV": Fader,
    "HPRO.SDIG.Controls.HProLatchingButton": OnOffButton,
}

def parse_control(control, *, show_broken_controls=False, **kwargs):
    global pages, has_error_boxes
    ctype = control.attrib.get("Type", None)
    try:
        assert ctype in control_types, "Unknown control type: " + str(ctype)
        ctrl = control_types[ctype]
        assert ctrl != None, "Unknown control type: " + str(ctype)
        assert type(ctrl) != TabPage, "Unexpected Tab Page"
        return ctrl.parse(
            control,
            show_broken_controls=show_broken_controls,
            **kwargs
        )
    except Exception as ex:
        if not show_broken_controls:
            raise ex
        print("Error rendering " + str(ctype) + ": " + str(ex))
        print(traceback.format_exc())
        has_error_boxes = True
        return ErrorBox.parse(control, show_broken_controls=show_broken_controls, **kwargs)


def parse_root_control(_images, control, *, depth=0, tabsize_=4, show_broken_controls=False):
    global images, pages, tabsize, has_error_boxes
    images = _images
    tabsize = tabsize_
    has_error_boxes = False
    panel = Panel.parse(control, depth=depth, tab_depth=0, tab=None, show_broken_controls=show_broken_controls)
    return panel, has_error_boxes

def total_pages():
    global pages
    return pages