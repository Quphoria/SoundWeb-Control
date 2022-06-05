import { withSessionRoute } from "../../../lib/withSession";
import { userDatabase } from "../../../lib/userDatabase";
import validSession from "../../../lib/validSession";

export default withSessionRoute(
  async function usersRoute(req, res) {
    try {
      const current_user = await validSession(req);
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }
      userDatabase.load();
      if (req.method === "PATCH") {
        const { id, password } = req.body;
        
        if (!password) throw { message: "Password cannot be empty" }
        if (password !== password.trim()) throw { message: "Password cannot start/end with whitespace" }

        const user = userDatabase.getById(id);
        if (!user) {
          res.send(`Unable to find user with id ${id}`);
          return;
        }

        userDatabase.update(id, {password, lastChange: new Date().toISOString()});
        console.log(`${current_user.username}#${current_user.id} Updated password for user ${user.username}#${id}`);
        res.send("Ok");
      } else {
        throw { message: "Unknown method: " + req.method }
      }
    } catch (e) {
      console.log("Error in users api:", e);
      res.send("Error");
    }
  }
);