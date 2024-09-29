import fs from "fs";

import { withSessionRoute } from "../../../lib/withSession";
import validSession from "../../../lib/validSession";

const show_panel_errors_path = ( process.env.DATA_DIR || "../../data/" ) + "SHOW_PANEL_ERRORS";

export default withSessionRoute(
  async function panelErrorsRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }

      if (req.method === "POST") {
        if (req.body.show_panel_errors === true) {
          fs.writeFileSync(show_panel_errors_path, "1");
          res.send({status: "ok"});
          process.exit(0);
        } else if (req.body.show_panel_errors === false) {
          if (fs.existsSync(show_panel_errors_path)) fs.rmSync(show_panel_errors_path);
          res.send({status: "ok"});
          process.exit(0);
        } else {
          res.send({status: "ok", show_panel_errors: fs.existsSync(show_panel_errors_path)});
        }
      } else {
        throw { message: "Unknown method: " + req.method }
      }
    } catch (e) {
      console.log("Error in panel show errors api:", e);
      res.status(500).send(e.toString());
    }
  }
);