import { withSessionRoute } from "../../../lib/withSession";
import validSession from "../../../lib/validSession";

export default withSessionRoute(
  async function restartRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }

      if (req.body?.restart) {
        res.send("Ok");
        process.exit(0);
      } else {
        res.status(400).send("Cancelled");
      }
    } catch (e) {
      console.log("Error in restart api:", e);
      res.status(500).send("Error");
    }
  }
);