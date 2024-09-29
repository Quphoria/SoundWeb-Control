import fs from "fs";

import { withSessionRoute } from "../../../lib/withSession";
import validSession from "../../../lib/validSession";

const panel_path = ( process.env.DATA_DIR || "../../data/" ) + "App.panel";
const show_panel_errors_path = ( process.env.DATA_DIR || "../../data/" ) + "SHOW_PANEL_ERRORS";

export default withSessionRoute(
  async function panelRestoreRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }

      if (req.body?.restore) {
        if (!fs.existsSync(panel_path + ".backup")) {
          throw new Error("No Backup Exists");
        }
        fs.copyFileSync(panel_path + ".backup", panel_path);
        // Clear show_panel_errors variable
        if (fs.existsSync(show_panel_errors_path)) fs.rmSync(show_panel_errors_path);
        res.send("Ok");
        process.exit(0);
      } else {
        res.status(400).send("Cancelled");
      }
    } catch (e) {
      console.log("Error in panel restore api:", e);
      res.status(500).send(e.toString());
    }
  }
);