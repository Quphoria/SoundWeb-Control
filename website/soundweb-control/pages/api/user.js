import { withSessionRoute } from "../../lib/withSession";
import { sanitised } from "../../lib/userDatabase";
import validSession from "../../lib/validSession";

export default withSessionRoute(
  async function userRoute(req, res) {
    const db_user = await validSession(req);
    if (!db_user) {
      res.send({isLoggedIn: false});
      return;
    }

    res.send({isLoggedIn: true, ...sanitised(db_user)});
  }
);