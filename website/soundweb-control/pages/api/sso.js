import { withSessionRoute } from "../../lib/withSession";
import createSSOToken from "../../config/ssoToken";
import validSession from "../../lib/validSession";
import { ssoAppDatabase } from "../../lib/ssoAppDatabase";

export default withSessionRoute(
  async function ssoRoute(req, res) {
    const sso_app_id = (req && req.query && req.query.sso_app_id) ? String(req.query.sso_app_id) : undefined;

    const db_user = await validSession(req);
    if (!db_user) {
      res.send({
        status: "redirect",
        url: "/sso/login"
      });
      return;
    }

    if (sso_app_id) {
      ssoAppDatabase.load();
      if (ssoAppDatabase.find((a) => (a.id === sso_app_id)) === undefined) {
        if (db_user.admin) {
          // Only admins can add a new app
          ssoAppDatabase.create(sso_app_id);
          res.send({
            status: "redirect",
            url: "/sso/access_denied"
          });
        } else {
          res.send({
            status: "redirect",
            url: "/sso/access_denied?new_app_id=1"
          });
        }
        return;
      } else if (!db_user.enabledSSOApps.includes(sso_app_id)) {
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