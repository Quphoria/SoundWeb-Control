import { withSessionRoute } from "../../../lib/withSession";
import { userDatabase } from "../../../lib/userDatabase";
import validSession from "../../../lib/validSession";
import { ssoAppDatabase } from "../../../lib/ssoAppDatabase";

export default withSessionRoute(
  async function userSSOAppsRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }
      if (req.method === "PATCH") {
        userDatabase.load();
        const { id, sso_app_id, action } = req.body;
        
        if (!sso_app_id) throw { message: "Missing sso_app_id" }
        if (!action) throw { message: "Missing action" }

        const user = userDatabase.getById(id);
        if (!user) {
          res.send(`Unable to find user with id ${id}`);
          return;
        }

        ssoAppDatabase.load();
        if (ssoAppDatabase.find((a) => (a.id === sso_app_id)) === undefined) {
          throw { message: `SSO App ${sso_app_id} does not exist, it can be created by attempting to login tto the app over SSO` }
        }

        var enabledSSOApps = user.enabledSSOApps;

        switch (action) {
          case "enable":
            if (!enabledSSOApps.includes(sso_app_id)) enabledSSOApps.push(sso_app_id);
            break;
          case "disable":
            enabledSSOApps = enabledSSOApps.filter(x => x !== sso_app_id);;
            break;
          default:
            res.send(`Unknown action ${action}`);
            return;
        }

        userDatabase.update(id, {enabledSSOApps, lastChange: new Date().toISOString()});
        console.log(`${current_user.username}#${current_user.id} Updated SSO Apps for user ${user.username}#${id} to ${JSON.stringify(enabledSSOApps)}`);
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