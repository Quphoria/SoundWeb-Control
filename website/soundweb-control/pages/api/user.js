import { withSessionRoute } from "../../lib/withSession";
import { userDatabase, sanitised } from "../../lib/userDatabase";
import { sessionOptions } from "../../config/session";

export default withSessionRoute(
  async function userRoute(req, res) {
    const ip = req.headers["x-real-ip"] || req.connection.remoteAddress;
    const user = req.session.user;
    // Check cookie has not expired
    if (user === undefined || sessionOptions.cookieLifetime + user.t < Date.now()) {
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
      res.send({isLoggedIn: false});
      return;
    }

    // Refresh session cookie if it will expire in the threshold time
    if ((sessionOptions.cookieLifetime + user.t) - Date.now() < sessionOptions.refreshThreshold*4) {
      console.log(`${user.username}#${user.id} session refreshed from ${ip}`);
      req.session.user.t = Date.now();
      await req.session.save();
    }

    res.send({isLoggedIn: true, ...sanitised(db_user)});
  }
);