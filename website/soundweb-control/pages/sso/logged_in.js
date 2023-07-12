import React from "react"
import { useEffect } from "react";
import Router from "next/router";
import useSWR from "swr";
import Button from "react-bootstrap/Button";

import SSOLayout from "../../layouts/sso";
import { Rainbow, Padding, Spacer } from "../../styles";
import { api_user_url, sso_logout_url } from "../../lib/siteUrls";


const LoggedIn = props => {
  const { data: user, mutate: mutateUser } = useSWR(api_user_url, url => fetch(url, {method: 'POST'}).then(res => res.json()));


  useEffect(() => {
    window.close();
  }, []);

  useEffect(() => {
    if (!user) return; // User info still loading

    if (!user?.isLoggedIn) {
      Router.push(sso_logout_url);
      return;
    };

  }, [user]);
  
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
          You are now logged in
        </h3>
        <p>You may now close this tab</p>
        <br />
        <Button 
          variant="outline-light"
          onClick={() => {Router.push(sso_logout_url)}}
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

export default LoggedIn