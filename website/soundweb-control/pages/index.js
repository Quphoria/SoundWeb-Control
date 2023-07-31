import Head from 'next/head'
import Layout from "../layouts"
import Link from "next/link"

import { Rainbow, Spacer } from '../styles'
import useUser from '../lib/useUser'
import { login_url, panel_url } from '../lib/siteUrls'

export default function Home() {
  const { user } = useUser();

  return (
    <Layout>
    <div className="container">
      <Head>
        <title>SoundWeb Control</title>
      </Head>

      <main>
        <h1 className="title">
          <Rainbow>SoundWeb</Rainbow>
        </h1>

        {/* <p className="description">
          Login to get started
        </p> */}

        <Link href={user?.isLoggedIn ? panel_url : login_url}> 
          <a
            className="btn btn-outline-light btn-lg"
            role="button"
          >Go To {user?.isLoggedIn ? "Panel" : "Login"}</a>
        </Link>

        <Spacer />
      </main>

      <style jsx>{`
        .container {
          flex: 1;
          padding: 0 0.5rem;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        main {
          padding: 5rem 0;
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
        }

        .title {
          margin: 0;
          line-height: 1.15;
          font-size: 4rem;
          padding-bottom: 1rem;
        }

        .title,
        .description {
          text-align: center;
        }

        .description {
          line-height: 1.5;
          font-size: 1.5rem;
        }
      `}</style>
    </div>
    </Layout>
  )
}
