import { withSessionRoute } from "../../lib/withSession";
import createAuthToken from "../../config/authToken";
import validSession from "../../lib/validSession";

export default withSessionRoute(
  async function authTokenRoute(req, res) {
    const { options } = await req.body;
    const db_user = await validSession(req);
    if (!db_user) {
      res.send(null);
      return;
    }
    const safe_options = {
      statusonly: !!options?.statusonly
    };

    // admin is checked per command on backend so statusonly is safe for regular users

    // Restrict access to certain options to admins only
    // if (!db_user.admin && safe_options.statusonly) {
    //   res.send(null);
    //   return;
    // }

    res.send(createAuthToken(db_user.username, db_user.admin, safe_options));
  }
);