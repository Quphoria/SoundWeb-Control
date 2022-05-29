import { withSessionRoute } from "../../../lib/withSession";
import { userDatabase, sanitised } from "../../../lib/userDatabase";

export default withSessionRoute(
  function usersRoute(req, res) {
    try {
      const current_user = req.session.user;
      if (!current_user?.admin) {
        res.send("Unauthorised");
        return;
      }
      userDatabase.load();
      if (req.method === "POST") {
        res.send(userDatabase.getAll().map(user => {
          if (user.admin) {
            // Censor password for admins
            return {...user, password: "********"};
          }
          return user;
        }));
      } else if (req.method === "PUT") {
        const { data: { username, password } } = req.body;
        if (!username) throw { message: "Username cannot be empty" }
        if (username !== username.trim()) throw { message: "Username cannot start/end with whitespace" }
        if (userDatabase.find(x => x.username.toLowerCase() === username.toLowerCase())) throw { message: "Username taken" }
        if (!password) throw { message: "Password cannot be empty" }
        if (password !== password.trim()) throw { message: "Password cannot start/end with whitespace" }

        const new_id = userDatabase.create({username, password});
        console.log(`${current_user.username}#${current_user.id} Created user ${username}#${new_id}`);
        res.send("Ok");
      } else if (req.method === "PATCH") {
        const { id, data } = req.body;
        if (id === current_user.id) {
          res.send("User cannot update self");
          return;
        }
        const allowed_keys = ["username", "admin", "disabled", "hiddenTabs"];
        if (Object.keys(data).filter(key => !allowed_keys.includes(key)).length > 0) {
          throw { message: "Illegal Field" }
        }
        const user = userDatabase.getById(id);
        if (!user) {
          res.send(`Unable to find user with id ${id}`);
          return;
        }
        console.log(`${current_user.username}#${current_user.id} Updated user ${user.username}#${user.id} with ${JSON.stringify(data)}`);
        userDatabase.update(id, {...data, lastChange: new Date().toISOString()});
        res.send("Ok");
      } else if (req.method === "DELETE") {
        const { id } = req.body;
        if (id === current_user.id) {
          res.send("User cannot delete self");
          return;
        }
        const user = userDatabase.getById(id);
        if (!user) {
          res.send(`Unable to find user with id ${id}`);
          return;
        }
        console.log(`${current_user.username}#${current_user.id} Deleted user ${user.username}#${id}`);
        userDatabase.delete(id);
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