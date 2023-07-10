import React from "react"
import { useEffect } from "react";
import Router from "next/router";
import { useRouter } from "next/router";
import useSWR from "swr";
import Button from "react-bootstrap/Button";

import SSOLayout from "../../layouts/sso";
import { Rainbow, Padding, Spacer } from "../../styles";


const AccessDenied = props => {
  const router = useRouter();
  const { data: user, mutate: mutateUser } = useSWR("/api/user", url => fetch(url, {method: 'POST'}).then(res => res.json()));

  useEffect(() => {
    if (!user) return; // User info still loading
    if (!router.query) return;

    if (!user?.isLoggedIn) {
      var url = { pathname: "/sso/logout" };
      if (router.query.callback) url.query = { callback: router.query.callback };
      Router.push(url);
      return;
    };

  }, [user, router.query]);
  
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
        <br />
        <h3>
          Access Denied
        </h3>
        <p>You are unable to use this external application, please contact an administrator</p>
        <br />
        <Button 
          variant="outline-light"
          onClick={() => {
            var url = { pathname: "/sso/logout" };
            if (router.query.callback) url.query = { callback: router.query.callback };
            Router.push(url);
          }}
          >
          Logout
        </Button>
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

export default AccessDenied