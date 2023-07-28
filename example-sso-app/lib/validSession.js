import config from "../config/config";

export default async function validSession(req) {
  const user = req.session.user;
  // Check session has not expired
  if (user === undefined || (config.sessionCookieLifetime*1000) + user.t < Date.now()) {
    await req.session.destroy();
    return;
  }

  return user;
}