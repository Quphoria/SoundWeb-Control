import os, sys

__location__ = os.path.realpath(
    os.path.join(os.getcwd(), os.path.dirname(__file__)))

def build_jsx(panel, pages):
    template_filename = "PanelContents.js.template"
    with open(os.path.join(__location__, template_filename), encoding="UTF-8") as f:
        panel_template = f.read()
    panel_contents = panel_template.replace("[TAB_COUNT]", str(pages))
    panel_contents = panel_contents.replace("[PANEL_JSX]", str(panel))
    
    with open("output/PanelContents.js", "w", encoding="UTF-8") as f:
        f.write(panel_contents)