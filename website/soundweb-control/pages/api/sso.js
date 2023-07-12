import { withSessionRoute } from "../../lib/withSession";
import createSSOToken from "../../config/ssoToken";
import validSession from "../../lib/validSession";
import { ssoAppDatabase } from "../../lib/ssoAppDatabase";
import urlBuilder from "../../lib/urlBuilder";

import { sso_login_url, sso_logout_url, sso_access_denied_url } from "../../lib/siteUrls";

export default withSessionRoute(
  async function ssoRoute(req, res) {
    const sso_app_id = (req && req.query && req.query.sso_app_id) ? String(req.query.sso_app_id) : undefined;
    const challenge = (req && req.query && req.query.challenge) ? String(req.query.challenge) : undefined;
    const callback = (req && req.query && req.query.callback) ? String(req.query.callback) : undefined;

    const db_user = await validSession(req);
    if (!db_user) {
      res.send({
        status: "redirect",
        url: urlBuilder(sso_login_url, {callback})
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
            url: urlBuilder(sso_access_denied_url, {callback})
          });
        } else {
          res.send({
            status: "redirect",
            url: urlBuilder(sso_access_denied_url, {callback, new_app_id: 1})
          });
        }
        return;
      } else if (!db_user.enabledSSOApps.includes(sso_app_id)) {
        res.send({
          status: "redirect",
          url: urlBuilder(sso_access_denied_url, {callback})
        });
        return;
      }
    }

    const logout_url = urlBuilder(sso_logout_url, {callback});

    res.send(createSSOToken(db_user.username, db_user.admin, sso_app_id, challenge, logout_url));
  }
);