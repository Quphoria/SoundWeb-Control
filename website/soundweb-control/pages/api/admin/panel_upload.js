import fs from "fs";

import { withSessionRoute } from "../../../lib/withSession";
import validSession from "../../../lib/validSession";

const panel_path = ( process.env.DATA_DIR || "../../data/" ) + "App.panel";
const show_panel_errors_path = ( process.env.DATA_DIR || "../../data/" ) + "SHOW_PANEL_ERRORS";

export default withSessionRoute(
  async function panelUploadRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }

      if (req.method === "POST") {
        if (!(req.body?.filename?.endsWith(".panel"))) {
          throw new Error("Invalid filename: " + req.body?.filename);
        }
        if (!(req.body?.data)) {
          throw new Error("No file data");
        }
        const buff = Buffer.from(req.body.data.split(',')[1], "base64");
        fs.writeFileSync(panel_path, buff);
        // Clear show_panel_errors variable
        if (fs.existsSync(show_panel_errors_path)) fs.rmSync(show_panel_errors_path);
        res.send("Ok");
        process.exit(0);
      } else {
        throw { message: "Unknown method: " + req.method }
      }
    } catch (e) {
      console.log("Error in panel upload api:", e);
      res.status(500).send(e.toString());
    }
  }
);