import React from "react"
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Router from "next/router";

import Layout from "../layouts"
import useUser from "../lib/useUser";
import { Rainbow, Padding, Spacer } from "../styles";
import { app_title, logout_url, panel_url } from "../lib/siteUrls";
import sendToken from "../lib/ssoLogin";

export default function Login() {
  // here we just check if user is already logged in and redirect to profile
  const router = useRouter();

  const { user, mutateUser } = useUser({
    redirectTo: (router && router.query && router.query.p) ? JSON.parse(router.query.p) : panel_url,
    redirectIfFound: true
  });

  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    console.log("User", user);
    if (!user?.sso) return;
    if (!user.sso.challenge || typeof(user.sso.url_base) != "string"|| typeof(user.sso.api) != "string") return;

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
        if (typeof(data.url) != "string") {
          console.log("Invalid Redirect Url:", data.url);
          throw new Error("Invalid Redirect Url");
        }
        Router.push(user.sso.url_base + data.url);
      } else if (data?.status == "ok") {
        sendToken(data.data, data.signature, () => {
          mutateUser();
        }, (e) => {
          setErrorMsg(e);
          setTimeout(() => {
            mutateUser();
          }, 5000);
        })
      } else if (data?.status == "error") {
        throw new Error(`SSO Api Error: ${data.message}`);
      } else {
        console.log("Unknown SSO Api Response:", data);
        throw new Error("SSO Api Error");
      }
    })
    .catch((e) => {
      console.log(e);
      if (e.message == "Failed to fetch") {
        setErrorMsg("Error connecting to SSO api");
      } else if (e instanceof SyntaxError) {
        setErrorMsg("Error communicating with SSO api");
      } else {
        setErrorMsg(e.message);
      }
    });
  }, [user])

  return (
    <Layout>
      <Padding style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <h1 className="title">
          <Rainbow>{app_title}</Rainbow>
        </h1>
        <div className="login">
          <h3>Logging in...</h3>
          {errorMsg && <p className="error">{errorMsg}</p>}
        </div>
        <Spacer />
        <style jsx>{`
          .login {
            max-width: 40rem;
            margin: 0 auto;
            padding: 2rem 4rem;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          .error {
            color: red;
            margin: 1rem 0 0;
          }
        `}</style>
      </Padding>
    </Layout>
  );
}
