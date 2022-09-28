import fs from "fs";

import { withSessionRoute } from "../../../lib/withSession";
import validSession from "../../../lib/validSession";

const panel_path = ( process.env.DATA_DIR || "../../data/" ) + "App.panel";

const saveFile = async (file) => {
  const data = fs.readFileSync(file.path);
  fs.writeFileSync(panel_path, data);
  await fs.unlinkSync(file.path);
  return;
};

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