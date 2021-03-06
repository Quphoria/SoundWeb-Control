import React from "react"
import Layout from "../layouts"
import Link from "next/link"
import redirect from 'nextjs-redirect'
import Head from "next/head"

import useUser from "../lib/useUser"
import { Padding, Rainbow } from "../styles"
import UserManager from "../components/admin/UserManager"
import BackendStatus from "../components/admin/BackendStatus"

export async function getStaticProps () {
  // `getStaticProps` is executed on the server side.
  const { config } = require("../config/config.js");

  return {
    props: {
      websocket: config.soundwebBridgeWebsocket
    }
  }
}

const Admin = props => {

  const { user } = useUser({
    redirectTo: "/login",
    redirectQuery: true
  });

  // Server-render loading state
  if (!user) {
    return <Layout><Padding>Loading...</Padding></Layout>
  }

  if (!user.isLoggedIn || !user.admin) {
    const Redirect = redirect("/");
    return (
      <Redirect>
        <div style={{
          padding: "2em",
          fontSize: 20
        }}>
          Redirecting to&nbsp;
          <Link href={{ pathname: "/" }}>
            <a>Home</a>
          </Link>...
        </div>
      </Redirect>
    )
  }

  const websocket_uri = props.websocket.replace("{HOST}", window.location.host.split(":",1)[0]);

  return (
    <Layout>
      <Head>
          <title>SoundWeb Admin</title>
          <meta name="viewport" content="initial-scale=1.0, width=device-width" />
      </Head>
      <Padding>
        <h2>Admin</h2>
        <h4>Hello <Rainbow>{user.username}#{user.id}</Rainbow></h4>
        <BackendStatus websocket={websocket_uri} />
        <UserManager user={user} />
      </Padding>
    </Layout>
  )
}

export default Admin