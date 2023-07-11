import { withSessionRoute } from "../../../lib/withSession";
import { userDatabase } from "../../../lib/userDatabase";
import validSession from "../../../lib/validSession";
import { ssoAppDatabase } from "../../../lib/ssoAppDatabase";

export default withSessionRoute(
  async function ssoAppsRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }
      userDatabase.load();
      if (req.method === "POST") {
        ssoAppDatabase.load();
        res.send(ssoAppDatabase.getAll());
        return;
      } else if (req.method === "PATCH") {
        const { sso_app_id, action } = req.body;
        
        if (!sso_app_id) throw { message: "Missing sso_app_id" }
        if (!action) throw { message: "Missing action" }

        ssoAppDatabase.load();
        if (ssoAppDatabase.find((a) => (a.id === sso_app_id)) === undefined) {
          throw { message: `SSO App ${sso_app_id} does not exist, it can be created by attempting to login to the app over SSO` }
        }

        switch (action) {
          case "enable":
            ssoAppDatabase.update(sso_app_id, { disabled: false });
            console.log(`${current_user.username}#${current_user.id} Enabled SSO App ${sso_app_id}`);
            res.send("Ok");
            break;
          case "disable":
            ssoAppDatabase.update(sso_app_id, { disabled: true });
            console.log(`${current_user.username}#${current_user.id} Disabled SSO App ${sso_app_id}`);
            res.send("Ok");
            break;
          case "delete":
            ssoAppDatabase.delete(sso_app_id);
            console.log(`${current_user.username}#${current_user.id} Deleted SSO App ${sso_app_id}`);
            res.send("Ok");
            break;
          default:
            res.send(`Unknown action ${action}`);
            return;
        }
      } else {
        throw { message: "Unknown method: " + req.method }
      }
    } catch (e) {
      console.log("Error in sso_apps api:", e);
      res.send("Error");
    }
  }
);