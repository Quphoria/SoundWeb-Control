import { withSessionRoute } from "../../lib/withSession";

export default withSessionRoute(
  async function logoutRoute(req, res, session) {
    const ip = req.headers["x-real-ip"] || req.connection.remoteAddress;
    if (req.session.user) {
      const user = req.session.user;
      console.log(`${user.username}#${user.id} logged out from ${ip}`);
    }
    await req.session.destroy();
    res.send({ ok: true, user: {isLoggedIn: false}});
  }
);