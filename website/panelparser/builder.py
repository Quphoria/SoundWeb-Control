import os, sys
import html

__location__ = os.path.realpath(
    os.path.join(os.getcwd(), os.path.dirname(__file__)))

def build_jsx(panel, pages, output_dir, has_errors=False):
    template_filename = "PanelContents.js.template"
    with open(os.path.join(__location__, template_filename), encoding="UTF-8") as f:
        panel_template = f.read()
    panel_contents = panel_template.replace("[TAB_COUNT]", str(pages))
    panel_contents = panel_contents.replace("[HAS_PANEL_ERRORS]", "true" if has_errors else "false")
    panel_contents = panel_contents.replace("[PANEL_JSX]", str(panel))
    
    with open(output_dir + "/PanelContents.js", "w", encoding="UTF-8") as f:
        f.write(panel_contents)

def build_error(error_title, error_message, error_traceback, output_dir):
    template_filename = "ErrorPanelContents.js.template"
    with open(os.path.join(__location__, template_filename), encoding="UTF-8") as f:
        panel_template = f.read()
    panel_contents = panel_template.replace("[ERROR_TITLE]", str(error_title)) # Not using <pre> so escape and replace newlines
    panel_contents = panel_contents.replace("[ERROR_MESSAGE]", str(error_message))
    panel_contents = panel_contents.replace("[ERROR_TRACEBACK]", str(error_traceback))
    
    with open(output_dir + "/PanelContents.js", "w", encoding="UTF-8") as f:
        f.write(panel_contents)

def build_nofile(output_dir):
    template_filename = "NoFilePanelContents.js"
    with open(os.path.join(__location__, template_filename), encoding="UTF-8") as f:
        panel_contents = f.read()
    with open(output_dir + "/PanelContents.js", "w", encoding="UTF-8") as f:
        f.write(panel_contents)