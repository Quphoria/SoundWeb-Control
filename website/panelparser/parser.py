import xml.etree.ElementTree as ET
import argparse
import os
import ntpath
import base64
import traceback
import shutil

from controls import parse_root_control, total_pages
from builder import build_jsx, build_error, build_nofile

images = {}

output_dir = "output"

def parse_images(ImageLibrarian):
    global images
    if not ImageLibrarian:
        return
    items = ImageLibrarian.find("Items")
    if not items:
        return
    entries = items.findall("ItemEntry")
    for entry in entries:
        Handle = entry.attrib.get("Handle", None)
        ResType = entry.attrib.get("ResType", None)
        ResourceName = entry.attrib.get("ResourceName", None)
        if Handle == None or ResType == None or ResourceName == None:
            continue
        if ResType == "THIS_DLL":
            image_path = ResourceName.replace("HPRO.SDIG.Controls.Images.", "")
            dots = image_path.count(".")
            images[Handle] = "resources/" + image_path.replace(".","/",dots-1) # don't replace file extension
        elif ResType == "FILE":
            image_name = ntpath.basename(ResourceName)
            Image = entry.find("Image", None)
            if Image == None:
                continue
            if not Image.text:
                continue
            image_path = output_dir + "/images/" + image_name
            with open(image_path, "wb") as f:
                f.write(base64.b64decode(Image.text))
            print("Written image:", image_path)
            images[Handle] = "images/" + image_name

def parse_panel(filename: str):
    tree = ET.parse(filename)
    Panels = tree.getroot()
    assert Panels.attrib.get("Version", None) == "Audio Architect", "File is not an Audio Architect panel"
    Panel = Panels.find("Panel")
    assert Panel != None, "Panel not found"
    title = Panel.attrib.get("Text", "Panel")
    # parse images
    os.makedirs(output_dir + "/images", exist_ok=True)
    parse_images(Panels.find("ImageLibrarian"))
    # parse panel
    root_control = parse_root_control(images, Panel, 3, 2)
    pages = total_pages()
    # with open("panel.xml", "w", encoding="UTF-8") as f:
    #     f.write(str(root_control))
    build_jsx(root_control, pages, output_dir)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Converts audioarchitect .panel files to JSX for react')
    parser.add_argument('file', help='The .panel file to open')
    parser.add_argument('-output_dir', '-o', default="output", help="The output directory")

    args = parser.parse_args()
    output_dir = args.output_dir
    try:
        parse_panel(args.file)
        print("Pages:", total_pages())
        shutil.copyfile(args.file, args.file + ".backup")
    except FileNotFoundError:
        print("No panel file found.")
        build_nofile(output_dir)
    except AssertionError as ex:
        print(ex)
        error_title = type(ex).__name__ + " while parsing panel file"
        error_message = str(ex)
        error_traceback = "\n".join(traceback.format_tb(ex.__traceback__))

        build_error(error_title, error_message, error_traceback, output_dir)
    except ET.ParseError as ex:
        print("Invalid Panel XML: ParseError:", ex)
        error_title = "Invalid Panel XML, file may not be a valid .panel file"
        error_message = "Unable to parse Panel XML: ParseError: " + str(ex)
        error_traceback = "\n".join(traceback.format_tb(ex.__traceback__))

        build_error(error_title, error_message, error_traceback, output_dir)