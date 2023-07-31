import Link from "next/link"

import Layout from "../layouts"
import useUser from '../lib/useUser'
import { panel_url, login_url, app_title } from '../lib/siteUrls'
import { Rainbow, Spacer } from '../styles'

export default function Home() {
  const { user } = useUser();

  return (
    <Layout>
    <div className="container">
      <main>
        <h1 className="title">
          <Rainbow>{app_title}</Rainbow>
        </h1>

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
