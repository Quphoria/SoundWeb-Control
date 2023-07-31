import React from "react"
import Layout from "../layouts"
import Link from "next/link"
import redirect from 'nextjs-redirect'

import useUser from "../lib/useUser"
import { Padding, Rainbow } from "../styles"
import { home_url, login_url } from "../lib/siteUrls"

export default function Admin() {

  const { user } = useUser({
    redirectTo: login_url,
    redirectQuery: true
  });

  // Server-render loading state
  if (!user) {
    return <Layout><Padding>Loading...</Padding></Layout>
  }

  if (!user.isLoggedIn || !user.info?.admin) {
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

  return (
    <Layout>
      <Padding>
        <h2>Admin</h2>
        <h4>Hello <Rainbow>{user.info?.username}</Rainbow></h4>
      </Padding>
    </Layout>
  )
}
