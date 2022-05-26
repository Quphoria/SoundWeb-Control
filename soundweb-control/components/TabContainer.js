
function TabContainer(props) {
    const { x, y, w, h, BackColor, ForeColor, font, children } = props;
    return (
        <div style={{
            position: "absolute",
            left: x,
            top: y,
            width: w,
            height: h,
            font: font ? font : "inherit",
            backgroundColor: BackColor ? BackColor : "inherit",
            ForeColor: ForeColor ? ForeColor : "inherit"
        }}>
            {children}
        </div>
    );
}

export default TabContainer;