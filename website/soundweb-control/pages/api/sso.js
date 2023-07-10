import { withSessionRoute } from "../../lib/withSession";
import createSSOToken from "../../config/ssoToken";
import validSession from "../../lib/validSession";
import { userDatabase } from "../../lib/userDatabase";

export default withSessionRoute(
  async function ssoRoute(req, res) {
    const sso_app_id = (req && req.query && req.query.sso_app_id) ? req.query.sso_app_id : undefined;

    const db_user = await validSession(req);
    if (!db_user) {
      res.send({
        status: "redirect",
        url: "/sso/login"
      });
      return;
    }

    if (sso_app_id) {
      var SSOApps = db_user.SSOApps;
      if (!(sso_app_id in SSOApps)) {
        SSOApps[sso_app_id] = db_user.admin ? "enabled" : "";
        userDatabase.update(db_user.id, {SSOApps});
      }
      if (SSOApps[sso_app_id] !== "enabled") {
        res.send({
          status: "redirect",
          url: "/sso/access_denied"
        });
        return;
      }
    }

    res.send(createSSOToken(db_user.username, db_user.admin, sso_app_id));
  }
);