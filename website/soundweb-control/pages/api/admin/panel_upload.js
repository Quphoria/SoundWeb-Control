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