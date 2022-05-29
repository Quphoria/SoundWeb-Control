import React from "react"
import Layout from "../layouts"
import Tabs from "../components/Tabs"
import useUser from "../lib/useUser"
import { Padding } from "../styles"

export async function getStaticProps () {
  // `getStaticProps` is executed on the server side.
  const { config } = require("../config/config.js");

  return {
    props: {
      websocket: config.soundwebBridgeWebsocket
    }
  }
}

const Panel = props => {
  const { user } = useUser({
    redirectTo: "/login",
    redirectQuery: true
  });

  // Server-render loading state
  if (!user?.isLoggedIn) {
    return <Layout><Padding>Loading...</Padding></Layout>
  }

  return (
    <Layout>
      <Tabs hiddenTabs={!user.admin && user.hiddenTabs} websocket={props.websocket} />
    </Layout>
  )
}
export default Panel