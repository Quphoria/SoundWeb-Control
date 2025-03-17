import { withSessionRoute } from "../../lib/withSession";
import { sanitised } from "../../lib/userDatabase";
import validSession from "../../lib/validSession";
import { ssoAppDatabase } from "../../lib/ssoAppDatabase";

export function getAppsList(db_user) {
  if (!db_user.enabledSSOApps) return [];

  ssoAppDatabase.load();
  return db_user.enabledSSOApps.map(app_id => {
    const app = ssoAppDatabase.find(a => a.id == app_id);
    if (app.disabled) return undefined;
    if (!app.listed || !app.listName || !app.listUrl) return undefined;
    return {
      name: app.listName,
      url: app.listUrl,
    };
  }).filter(v => v !== undefined);
}

export default withSessionRoute(
  async function userRoute(req, res) {
    const db_user = await validSession(req);
    if (!db_user) {
      res.send({isLoggedIn: false});
      return;
    }

    const apps_list = getAppsList(db_user);

    res.send({isLoggedIn: true, apps_list, ...sanitised(db_user)});
  }
);