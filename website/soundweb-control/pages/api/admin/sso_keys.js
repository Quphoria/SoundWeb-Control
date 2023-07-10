import { withSessionRoute } from "../../../lib/withSession";
import validSession from "../../../lib/validSession";
import { generateSSOKeys, getPublicKey } from "../../../config/ssoToken";

export default withSessionRoute(
  async function ssoKeysRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }

      if (req.method !== "POST") {
        throw { message: "Unknown method: " + req.method };
      }

      if (req.body?.generate) {
        generateSSOKeys();
        res.send("Ok");
      } else {
        res.send(getPublicKey());
      }
    } catch (e) {
      console.log("Error in sso key api:", e);
      res.status(500).send(e.toString());
    }
  }
);