import { withSessionRoute } from "../../lib/withSession";
import { userDatabase, sanitised } from "../../lib/userDatabase";
import createAuthToken from "../../config/authToken";

export default withSessionRoute(
  async function authTokenRoute(req, res) {
    const ip = req.headers["x-real-ip"] || req.connection.remoteAddress;
    const user = req.session.user;
    if (user === undefined) {
      res.send({isLoggedIn: false});
      return;
    }
    userDatabase.load();
    const db_user = userDatabase.find(u => 
      u.id === user.id && 
      u.username === user.username && 
      u.password === user.password && 
      u.admin === user.admin &&
      !u.disabled);

    if (!db_user) {
      console.log(`${user.username}#${user.id} invalid session from ${ip}`);
      await req.session.destroy();
      res.send({});
      return;
    }
    res.send(createAuthToken(db_user.username));
  }
);