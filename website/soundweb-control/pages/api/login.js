import { withSessionRoute } from "../../lib/withSession";
import { userDatabase, sanitised } from "../../lib/userDatabase";
import { getAppsList } from "./user";

export default withSessionRoute(
  async function loginRoute(req, res) {
    const ip = req.headers["x-real-ip"] || req.connection.remoteAddress;
    const { username, password } = await req.body;

    try {
      userDatabase.load();
      // get user from database then:
      const user = userDatabase.find(x => x.username.toLowerCase() == username.toLowerCase() && x.password == password);

      if (user === undefined) {
        throw { message: "Incorrect username or password" }
      }
      if (user.disabled) {
        throw { message: "User account disabled" }
      }
      userDatabase.update(user.id, { lastLogin: new Date().toISOString() });

      console.log(`${user.username}#${user.id} logged in from ${ip}`);
      req.session.user = {
        id: user.id,
        username: user.username,
        password: user.password, // Used for checking that the password has not been changed on the /api/user endpoint
        admin: user.admin,
        t: Date.now()
      };
      await req.session.save();

      const apps_list = getAppsList(user);

      res.send({ ok: true, user: {isLoggedIn: true, apps_list, ...sanitised(user)} });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: true,  message: error.message });
    }
  }
);