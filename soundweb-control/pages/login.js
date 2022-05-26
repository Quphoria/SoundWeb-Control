import React from "react"
import { useState } from "react";
import { useRouter } from "next/router";

import Layout from "../layouts"
import LoginForm from "../components/LoginForm";
import fetchJson, { FetchError } from "../lib/fetchJson";
import useUser from "../lib/useUser";
import { Padding, Spacer } from "../styles";


const Login = props => {
  // here we just check if user is already logged in and redirect to profile
  const router = useRouter();

  const { mutateUser } = useUser({
    redirectTo: (router && router.query && router.query.p) ? JSON.parse(router.query.p) : "/panel",
    redirectIfFound: true
  });

  const [errorMsg, setErrorMsg] = useState("");

  return (
    <Layout>
      <Padding style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div className="login">
          <LoginForm
            errorMessage={errorMsg}
            onSubmit={async function handleSubmit(event) {
              event.preventDefault();

              const body = {
                username: event.currentTarget.username.value,
                password: event.currentTarget.password.value
              };

              try {
                const login_req = await fetchJson("/api/login", {
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
    </Layout>
  );
}

export default Login