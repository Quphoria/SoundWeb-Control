import React from "react"
import Layout from "../layouts"
import Link from "next/link"
import redirect from 'nextjs-redirect'
import useUser from "../lib/useUser"
import { Padding, Rainbow } from "../styles"
import UserManager from "../components/admin/UserManager"

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

  return (
    <Layout>
      <Padding>
        <h2>Admin</h2>
        <h4>Hello <Rainbow>{user.username}#{user.id}</Rainbow></h4>
        <UserManager user={user} />
      </Padding>
    </Layout>
  )
}

export default Admin