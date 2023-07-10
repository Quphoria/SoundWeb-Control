import { withSessionRoute } from "../../../lib/withSession";
import { userDatabase } from "../../../lib/userDatabase";
import validSession from "../../../lib/validSession";

export default withSessionRoute(
  async function userSSOAppsRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }
      userDatabase.load();
      if (req.method === "PATCH") {
        const { id, sso_app_id, action } = req.body;
        
        if (!sso_app_id) throw { message: "Missing sso_app_id" }
        if (!action) throw { message: "Missing action" }

        const user = userDatabase.getById(id);
        if (!user) {
          res.send(`Unable to find user with id ${id}`);
          return;
        }

        var SSOApps = user.SSOApps;

        if (!(sso_app_id in SSOApps)) {
          res.send(`Unable to find SSO App with id ${sso_app_id}`);
          return;
        }

        switch (action) {
          case "enable":
            SSOApps[sso_app_id] = "enabled";
            break;
          case "disable":
            SSOApps[sso_app_id] = "";
            break;
          case "delete":
            SSOApps[sso_app_id] = "";
            delete SSOApps[sso_app_id];
            break;
          default:
            res.send(`Unknown action ${action}`);
            return;
        }

        userDatabase.update(id, {SSOApps, lastChange: new Date().toISOString()});
        console.log(`${current_user.username}#${current_user.id} Updated SSO Apps for user ${user.username}#${id} to ${JSON.stringify(SSOApps)}`);
        res.send("Ok");
      } else {
        throw { message: "Unknown method: " + req.method }
      }
    } catch (e) {
      console.log("Error in user_sso_apps api:", e);
      res.send("Error");
    }
  }
);