import { withSessionRoute } from "../../lib/withSession";
import validSession from "../../lib/validSession";

export default withSessionRoute(
  async function adminTestRoute(req, res) {
    const user = await validSession(req);

    if (!user?.isLoggedIn || !user.info?.admin) {
        res.status(401).send({msg: "Unauthorised"});
        return;
    }

    res.send({msg: "Success!"});
    return;
  }
);