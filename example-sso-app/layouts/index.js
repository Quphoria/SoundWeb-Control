import React from "react"
import Link from "next/link"
import { Global, css } from "@emotion/react"
import { useEffect } from "react"

import useUser from "../lib/useUser"
import { admin_url, home_url, login_url, logout_url, panel_url } from "../lib/siteUrls"
import { Nav, PageBody, Footer } from "../styles"
import { refreshToken } from "../lib/ssoLogin"

const Layout = ({ children }) => { 
  const { user, mutateUser } = useUser();

  useEffect(() => {
    // update user info every 60 seconds
    // this will also refresh the cookie as needed
    const intervalId = setInterval(() => mutateUser(), 60000); 
  
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (user?.isLoggedIn) {
      refreshToken(user, mutateUser);
    }
  }, [user]);

  return (
    <React.Fragment>
      <Global
        styles={css`
          #__next {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          html,
          body {
            padding: 0;
            margin: 0;
            color: white;
            background-color: black;
            font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
              Oxygen, Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue,
              sans-serif;
            -webkit-link: white;
          }
          * {
            box-sizing: border-box;
          }
          a {
            text-decoration: none;
          }
          a:hover {
            color: WhiteSmoke;
          }
          @media not all and (min-resolution:.001dpcm)
          { @supports (-webkit-appearance:none) {
              select {
                /* fix background color on webkit browsers */
                appearance: none;
                -moz-appearance: none;
                -webkit-appearance: none;
                padding: 0.4em;
                background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
                background-repeat: no-repeat;
                background-position: right .7em top 50%;
                background-size: .65em auto;
                background-blend-mode: difference;
              }
          }}
          @media screen and (min-color-index:0) and(-webkit-min-device-pixel-ratio:0){ 
            @media {
              select {
                /* fix background color on webkit browsers */
                appearance: none;
                -moz-appearance: none;
                -webkit-appearance: none;
                padding: 0.4em;
                background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E');
                background-repeat: no-repeat;
                background-position: right .7em top 50%;
                background-size: .65em auto;
                background-blend-mode: difference;
              }
          }}
        `}
      />
      <Nav>
        <Link href={home_url}>
          <a>Home</a>
        </Link>
        {
          user?.isLoggedIn &&
          (
            <Link href={panel_url}>
              <a>Panel</a>
            </Link>
          )
        }
        {
          user?.isLoggedIn && user.info?.admin &&
          (
            <Link href={admin_url}>
              <a>Admin</a>
            </Link>
          )
        }
        {
          !user?.isLoggedIn ?
          (<Link href={login_url}>
            <a>Login</a>
          </Link>) :
          (<Link href={logout_url}>
            <a>Logout</a>
          </Link>)
        }
      </Nav>
      <PageBody>{children}</PageBody>
      <Footer>
        <p
          style={{fontSize: "0.8e m"}}
        >
          2023{new Date().getFullYear() > 2023 ? "-" + new Date().getFullYear() : ""} © <a href="https://github.com/Quphoria" style={{color: "inherit"}}>Samuel Simpson</a>, All rights reserved
        </p>
      </Footer>
    </React.Fragment>
  )
}

export default Layout