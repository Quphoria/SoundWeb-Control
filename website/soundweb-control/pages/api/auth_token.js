import { withSessionRoute } from "../../lib/withSession";
import createAuthToken from "../../config/authToken";
import validSession from "../../lib/validSession";

export default withSessionRoute(
  async function authTokenRoute(req, res) {
    const db_user = await validSession(req);
    if (!db_user) {
      res.send(null);
      return;
    }
    res.send(createAuthToken(db_user.username, db_user.admin));
  }
);