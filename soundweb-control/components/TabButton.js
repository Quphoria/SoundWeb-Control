import Link from "next/link"

function TabButton(props) {
    const { isSubtab, tab_number, depth, set_function, pathname, name, is_selected, width, height, colour, backColour, font } = props;
    const borderSize = 1;

    var style = {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: backColour,
        color: colour,
        minWidth: width,
        minHeight: height,
        paddingLeft: "1.5em",
        paddingRight: "1.5em",
        paddingTop: "0.5em",
        paddingBottom: "0.5em",
        font: font ? font : "inherit",
        borderStyle: "solid",
        borderWidth: borderSize,
        borderBottomWidth: is_selected ? 0 : borderSize,
        borderColor: colour,
        boxSizing: "border-box",
    };
    
    if (isSubtab) {
        return (
            <div selected={is_selected} onClick={() => {set_function(depth, tab_number)}} style={style}>
                <a className="pointernormal" style={{fontWeight: is_selected ? "bold" : null, color: "inherit"}}>{name}</a>
            </div>
        );
    } else {
        return (
            <Link href={{ pathname: pathname, query: { tab: tab_number } }}>
                <div selected={is_selected}style={style}>
                    <a className="pointernormal" style={{fontWeight: is_selected ? "bold" : null, color: "inherit"}}>{name}</a>
                </div>
            </Link>
        );
    }
}

export default TabButton;