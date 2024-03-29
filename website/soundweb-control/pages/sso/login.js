import React from "react";
import { useState, useEffect } from "react";
import Router from "next/router";
import { useRouter } from "next/router";
import useSWR from "swr";

import SSOLayout from "../../layouts/sso";
import LoginForm from "../../components/LoginForm";
import fetchJson, { FetchError } from "../../lib/fetchJson";
import { Rainbow, Padding, Spacer } from "../../styles";
import { api_login_url, api_user_url, sso_logged_in_url } from "../../lib/siteUrls";


const Login = props => { 
  const router = useRouter();

  const { data: user, mutate: mutateUser } = useSWR(api_user_url, url => fetch(url, {method: 'POST'}).then(res => res.json()));

  useEffect(() => {
    // if user data not yet there (fetch in progress, logged in or not) then don't do anything yet
    if (!user?.isLoggedIn) return;
    if (!router.query) return;

    const redirectTo = (router && router.query && router.query.callback) ? JSON.parse(router.query.callback) : undefined;

    console.log(redirectTo);
    if (redirectTo) {
      Router.push(redirectTo);
    } else { 
      Router.push(sso_logged_in_url);
    }
  }, [user, router.query]);

  function cancelLogin() {
    const cancelUrl = (router && router.query && router.query.logout_callback) ? JSON.parse(router.query.logout_callback) : undefined;

    if (cancelUrl) {
      Router.push(cancelUrl);
    } else { 
      window.close();
    }
  }

  const [errorMsg, setErrorMsg] = useState("");

  return (
    <SSOLayout>
      <Padding style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <h1 className="title">
          <Rainbow>SoundWeb Control</Rainbow>
        </h1>
        <h1 className="title">
          <Rainbow>SSO</Rainbow>
        </h1>
        <div className="login">
          <LoginForm
            errorMessage={errorMsg}
            cancelFunction={cancelLogin}
            onSubmit={async function handleSubmit(event) {
              event.preventDefault();

              const body = {
                username: event.currentTarget.username.value,
                password: event.currentTarget.password.value
              };

              try {
                const login_req = await fetchJson(api_login_url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });

                if (login_req.error) {
                  throw login_req.message;
                }

                if (login_req.ok) {
                  mutateUser(
                    login_req.user,
                    false
                  );
                }
              } catch (error) {
                if (error instanceof FetchError) {
                  setErrorMsg(error.data.message);
                } else {
                  console.error("An unexpected error happened:", error);
                }
              }
            }}
          />
        </div>
        <Spacer />
        <style jsx>{`
          .login {
            max-width: 21rem;
            margin: 0 auto;
            padding: 2rem 4rem;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
        `}</style>
      </Padding>
    </SSOLayout>
  );
}

export default Login