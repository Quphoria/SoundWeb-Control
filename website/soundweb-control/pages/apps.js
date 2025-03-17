import Head from 'next/head'
import Layout from "../layouts"

import { Rainbow } from '../styles'
import useUser from '../lib/useUser'
import { login_url } from '../lib/siteUrls'
import { Button } from 'react-bootstrap'

export default function Home() {
  const { user } = useUser({
    redirectTo: login_url,
    redirectQuery: true
  });

  return (
    <Layout>
    <div>
      <Head>
        <title>SoundWeb Apps</title>
      </Head>

      <main>
        <h1 className="title mb-4">
          <Rainbow>Connected Apps</Rainbow>
        </h1>

        <div>
          {
            user?.apps_list?.map(({name, url}) => (
              <Button variant="outline-light w-100 px-5 d-block" as="a" href={url} className="mb-2">
                {name}
              </Button>
            ))
          }
          {
            !(user?.apps_list?.length) && (
              <i>No Apps</i>
            )
          }
        </div>
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
