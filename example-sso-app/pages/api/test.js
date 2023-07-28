import { withSessionRoute } from "../../lib/withSession";
import validSession from "../../lib/validSession";

export default withSessionRoute(
  async function testRoute(req, res) {
    const user = await validSession(req);

    if (!user?.isLoggedIn) {
        res.status(401).send("Unauthorised");
        return;
    }

    res.send({msg: "Success!"});
    return;
  }
);