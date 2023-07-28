import { api_user_url, logout_url } from "./siteUrls";

export default function sendToken(data, signature, callback, error_callback) {
  fetch(api_user_url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      token: {data, signature}
    })
  }).then((r) => r.json()).then((data) => {
    if (data.error) {
      throw new Error(`Auth Error: ${data.error}`)
    } else {
      if (data.isLoggedIn) callback && callback();
      else throw new Error("Not logged in");
    }
  }).catch((e) => {
    console.log(e);
    error_callback && error_callback("Failed to auth");
  });
}

export function refreshToken(user, mutateUser) {
  if (!user?.isLoggedIn) return;
  if (!user?.sso?.challenge) return;
  if (typeof(user.sso.url_base) != "string" || typeof(user.sso.api) != "string") return;

  fetch(user.sso.url_base + user.sso.api, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: "include",
    body: JSON.stringify({
      sso_app_id: user.sso.app_id,
      callback: window.location.href,
      logout_callback: new URL(logout_url, window.location.href).href,
      // Maybe we add callback for access denied? to go to homepage
      challenge: user.sso.challenge
    })
  }).then((r) => r.json())
  .then((data) => {
    if (data?.status == "redirect") {
      // Redirect means SSO failed, so just logout
      Router.push(logout_url);
    } else if (data?.status == "ok") {
      sendToken(data.data, data.signature, () => {
        mutateUser();
      }, (e) => {
        console.log(e);
        setTimeout(() => {
          mutateUser();
        }, 5000);
      });
    } else if (data?.status == "error") {
      throw new Error(`SSO Api Error: ${data.message}`);
    } else {
      console.log("Unknown SSO Api Response:", data);
      throw new Error("SSO Api Error");
    }
  })
  .catch((e) => {
    console.log(e);
  });
}