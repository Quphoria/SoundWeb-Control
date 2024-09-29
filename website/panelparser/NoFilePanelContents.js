import { Padding } from "./styles";

export const tab_count = -1;
export const has_panel_errors = false;

function PanelContents(props) {
  return (
    <Padding>
      <h2>No panel file uploaded!</h2>
      <div>Please follow the Getting Started guide at &nbsp;
        <a href="https://github.com/Quphoria/SoundWeb-Control">https://github.com/Quphoria/SoundWeb-Control</a>
      </div>
    </Padding>
  );
}

export default PanelContents;