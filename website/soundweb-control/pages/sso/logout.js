import React from "react"
import { useEffect } from "react";
import Router from "next/router";
import { useRouter } from "next/router";
import useSWR from "swr";
import Button from "react-bootstrap/Button";

import SSOLayout from "../../layouts/sso"
import fetchJson from "../../lib/fetchJson";
import { Rainbow, Padding, Spacer } from "../../styles";


const Logout = props => {
  const router = useRouter();

  const { data: user, mutate: mutateUser } = useSWR("/api/user", url => fetch(url, {method: 'POST'}).then(res => res.json()));

  useEffect(() => {
    if (!router.query) return;
    
    let timer;
    function call_logout() {
      fetchJson("/api/logout", { method: "POST" })
      .then((data) => {
        mutateUser(data.user, false);
        const redirectTo = (router && router.query && router.query.callback) ? JSON.parse(router.query.callback) : undefined;
        if (redirectTo) {
          Router.push(redirectTo);
        } else {
          window.close();
        }
      })
      .catch(() => {
        console.log("Failed to logout, retrying in 5 seconds...");
        timer = setTimeout(call_logout, 5000);
      });
    }
    call_logout();

    return () => {
      clearTimeout(timer);
    };
  }, [router.query]);
  

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
        <p>{user?.isLoggedIn ? "Logging out..." : "Logged out"}</p>
        <br />
        <Button 
          variant="outline-light"
          onClick={() => {Router.push("/sso/login")}}
          >
          Login
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

export default Logout