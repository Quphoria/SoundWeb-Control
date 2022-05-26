import { withSessionRoute } from "../../lib/withSession";
import { userDatabase, sanitised } from "../../lib/userDatabase";

export default withSessionRoute(
  async function userRoute(req, res) {
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
      u.admin === user.admin);
    if (!db_user) {
      console.log(`${user.username}#${user.id} invalid session from ${ip}`);
      await req.session.destroy();
      res.send({isLoggedIn: false});
      return;
    }
    res.send({isLoggedIn: true, ...sanitised(db_user)});
  }
);