import { withSessionRoute } from "../../lib/withSession";
import validSession from "../../lib/validSession";
import crypto from "crypto";
import { config } from "../../config/config";
import validateToken from "../../config/ssoToken";

function sanitised(user) {
  // This function returns data that can be received by clients
  if (user === undefined) {
    throw { message: "No user provided" };
  }

  const { isLoggedIn, info } = user;
  var { sso } = user;
  if (!sso) sso = {};
  sso.app_id = config.ssoAppId,
  sso.url_base = config.ssoBaseUrl,
  sso.api = config.ssoApi

  return { isLoggedIn, info, sso };
}

export default withSessionRoute(
  async function userRoute(req, res) {
    var user = await validSession(req);

    if (!user) {
      req.session.user = {
        isLoggedIn: false,
        t: Date.now()
      };
      await req.session.save();
      user = req.session.user;
    }

    if (!user.isLoggedIn || ((config.sessionCookieLifetime*1000) + user.t) - Date.now() < (config.ssoRefreshThreshold*1000)) {
      if (!user.sso) {
        req.session.user.sso = {
          challenge: crypto.randomInt(1, 2**32) // Get a secure random 32-bit number (not zero)
        };
        await req.session.save();
        user = req.session.user;
      }
    }

    if (req.method == "POST") { // Get user data
      res.send(sanitised(user));
    } else if (req.method == "PUT") {
      const { logout } = await req.body;
      if (logout) {
        await req.session.destroy();
        res.send({"isLoggedIn": false, t: Date.now()});
        return;
      }

      if (!user.sso) {
        res.send({
          error: "Invalid session"
        });
      } else {
        try {
          // Handle user sso validation
          const { token } = await req.body;
          if (!token) throw new Error("Missing token");

          const validated = validateToken(token);
          if (validated.challenge !== user.sso.challenge) {
            throw new Error("Invalid challenge");
          }
          if (validated.sso_app_id !== config.ssoAppId) {
            throw new Error("Invalid app id");
          }
          const { username, admin, time } = validated;
          req.session.user.isLoggedIn = true;
          req.session.user.t = Date.now(); // Update cookie time on validation
          req.session.user.info = { username, admin, time };
          req.session.user.sso = undefined; // Remove SSO info (clear challenge)
          await req.session.save();
          res.send(sanitised(req.session.user));
        } catch (e) {
          // Destroy session to prevent bruteforce guessing of challenge
          await req.session.destroy();
          res.send({
            error: e.message
          });
          return;
        }
      }
    }
  }
);