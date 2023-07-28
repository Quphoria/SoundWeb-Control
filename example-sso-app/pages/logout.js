import React from "react"
import { useState, useEffect } from "react";
import Router from "next/router";

import Layout from "../layouts"
import useUser from "../lib/useUser";
import { Rainbow, Padding, Spacer } from "../styles";
import { api_user_url, app_title, home_url } from "../lib/siteUrls";


export default function Logout() {
  const { user, mutateUser } = useUser();

  const [errorMsg, setErrorMsg] = useState("");

  function finish_logout() {
    fetch(api_user_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logout: 1
      })
    }).then((r) => {
      if (r.ok) {
        mutateUser();
        Router.push(home_url);
      } else {
        r.text().then((t) => {
          console.log(t);
          setErrorMsg("Error logging out");
        })
      }
    }).catch((e) => {
      console.log(e);
      setErrorMsg("Error logging out");
    });
  }

  useEffect(() => {
    console.log("User", user);
    if (!user?.sso) return;

    fetch(user.sso.url_base + user.sso.api, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: "include",
      body: JSON.stringify({
        logout: 1
      })
    }).then((r) => r.json())
    .then((data) => {
      if (data?.status == "logged_out") {
        finish_logout();
      } else {
        console.log(data);
        setErrorMsg("Error logging out of SSO");
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
          <h3>Logging out...</h3>
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
