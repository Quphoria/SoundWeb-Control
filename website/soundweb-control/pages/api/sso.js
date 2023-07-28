import { withSessionRoute } from "../../lib/withSession";
import createSSOToken from "../../config/ssoToken";
import validSession from "../../lib/validSession";
import { ssoAppDatabase } from "../../lib/ssoAppDatabase";
import urlBuilder from "../../lib/urlBuilder";
import { config } from "../../config/config";

import { sso_login_url, sso_logout_url, sso_access_denied_url } from "../../lib/siteUrls";

function setCORSHeaders(req, res) {
  if (!config.allowedSSOOrigins.includes(req.headers.origin)) return;

  // Website you wish to allow to connect
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin);

  // Request methods you wish to allow
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  // Request headers you wish to allow
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

  // Set to true if you need the website to include cookies in the requests sent
  // to the API (e.g. in case you use sessions)
  res.setHeader('Access-Control-Allow-Credentials', true);
}

export default withSessionRoute(
  async function ssoRoute(req, res) {
    const sso_app_id = (req && req.body && req.body.sso_app_id) ? String(req.body.sso_app_id) : undefined;
    const challenge = (req && req.body && req.body.challenge) ? req.body.challenge : undefined;
    const callback = (req && req.body && req.body.callback) ? String(req.body.callback) : undefined;
    const logout_callback = (req && req.body && req.body.logout_callback) ? String(req.body.logout_callback) : undefined;

    setCORSHeaders(req, res);

    if (req?.body?.logout) {
      const ip = req.headers["x-real-ip"] || req.connection.remoteAddress;
      const user = req.session.user;
      if (user) console.log(`${user.username}#${user.id} logged out from ${ip} via SSO`);
      await req.session.destroy();
      res.send({
        status: "logged_out"
      });
      return;
    }

    const db_user = await validSession(req);
    if (!db_user) {
      res.send({
        status: "redirect",
        url: urlBuilder(sso_login_url, {callback: JSON.stringify(callback), logout_callback: JSON.stringify(logout_callback)})
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
            url: urlBuilder(sso_access_denied_url, {callback: JSON.stringify(logout_callback)})
          });
        } else {
          res.send({
            status: "redirect",
            url: urlBuilder(sso_access_denied_url, {new_app_id: 1, callback: JSON.stringify(logout_callback)})
          });
        }
        return;
      } else if (!db_user.enabledSSOApps.includes(sso_app_id)) {
        res.send({
          status: "redirect",
          url: urlBuilder(sso_access_denied_url, {callback: JSON.stringify(logout_callback)})
        });
        return;
      }
    }

    const logout_url = urlBuilder(sso_logout_url, {callback: JSON.stringify(logout_callback)});

    res.send(createSSOToken(db_user.username, db_user.admin, sso_app_id, challenge, logout_url));
  }
);