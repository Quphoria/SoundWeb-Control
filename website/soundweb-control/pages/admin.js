import React from "react"
import Layout from "../layouts"
import Link from "next/link"
import redirect from 'nextjs-redirect'
import Head from "next/head"
import { useState } from "react"

import useUser from "../lib/useUser"
import { Padding, Rainbow } from "../styles"
import UserManager from "../components/admin/UserManager"
import BackendStatus from "../components/admin/BackendStatus"
import UploadPanelDialog from "../components/admin/UploadPanelDialog"
import SSOSettingsDialog from "../components/admin/SSOSettingsDialog"
import { home_url, login_url } from "../lib/siteUrls"

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
    redirectTo: login_url,
    redirectQuery: true
  });
  const [ssoSettingsModalState, setSSOSettingsModalState] = useState({show: false});
  const [uploadPanelModalState, setUploadPanelModalState] = useState({show: false});
  const [backendStatusRestartCallback, setBackendStatusRestartCallback] = useState({callback: null});

  // Server-render loading state
  if (!user) {
    return <Layout><Padding>Loading...</Padding></Layout>
  }

  if (!user.isLoggedIn || !user.admin) {
    const Redirect = redirect(home_url);
    return (
      <Redirect>
        <div style={{
          padding: "2em",
          fontSize: 20
        }}>
          Redirecting to&nbsp;
          <Link href={{ pathname: home_url }}>
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
      <SSOSettingsDialog state={ssoSettingsModalState} setState={setSSOSettingsModalState} />
      <UploadPanelDialog state={uploadPanelModalState} setState={setUploadPanelModalState} />
      <Padding>
        <h2>Admin</h2>
        <h4>Hello <Rainbow>{user.username}#{user.id}</Rainbow></h4>
        <BackendStatus websocket={websocket_uri} setRestartCallback={setBackendStatusRestartCallback} />
        <UserManager user={user} />
      </Padding>
      <div style={{
          marginTop: "auto",
          padding: "0.5rem 1rem",
          textAlign: "right",
          fontSize: "0.8rem",
          cursor: "pointer"
        }}>
        <a onClick={() => setSSOSettingsModalState({show: true})}
          style={{textDecoration: "underline", color: "var(--bs-info)"}}>SSO Settings</a> &nbsp;&nbsp;
        <a onClick={backendStatusRestartCallback.callback}
          style={{textDecoration: "underline", color: "var(--bs-danger)"}}>Restart Backend</a> &nbsp;&nbsp;
        <a onClick={() => setUploadPanelModalState({show: true})}
          style={{textDecoration: "underline", color: "var(--bs-info)"}}>Upload Panel File</a>
      </div>
    </Layout>
  )
}

export default Admin