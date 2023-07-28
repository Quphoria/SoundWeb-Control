import React, { useState } from "react"
import Layout from "../layouts"
import useUser from "../lib/useUser"
import { Padding, Rainbow, Spacer } from "../styles"
import { api_admin_test_url, api_test_url, app_title, login_url } from "../lib/siteUrls"
import fetchJson, { FetchError } from "../lib/fetchJson"

export default function Panel() {
  const { user } = useUser({
    redirectTo: login_url,
    redirectQuery: true
  });

  const [errorMsg, setErrorMsg] = useState("");

  const [feedbackUser, setFeedbackUser] = useState("");
  const [feedbackAdmin, setFeedbackAdmin] = useState("");

  // Server-render loading state
  if (!user?.isLoggedIn) {
    return <Layout><Padding>Loading...</Padding></Layout>
  }

  async function test_api(admin_test=false) {
    const test_url = admin_test ? api_admin_test_url : api_test_url;
    const setFeedback = admin_test ? setFeedbackAdmin : setFeedbackUser;
    
    setFeedback("");
    setErrorMsg("");

    try {
      var { msg } = await fetchJson(test_url, { method: "POST" });
      setFeedback(msg);
      setTimeout(() => setFeedback(""), 2000);
    } catch (e) {
      console.log("Test Error:", e);
      if (e instanceof FetchError) {
        setFeedback(e.data?.msg);
        setTimeout(() => setFeedback(""), 2000);
      }
      setErrorMsg(`Error: ${e.message}`);
    }
  }

  return (
    <Layout>
      <Padding style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <h1 className="title">
          <Rainbow>{app_title}</Rainbow>
        </h1>
        <div className="content">
          <a
            className="btn btn-outline-light btn-lg"
            role="button"
            onClick={async (e) => {
              e.preventDefault();
              await test_api(false);
            }}
          >Test (User)</a>
          <p>{feedbackUser}</p>
          <br />

          <a
            className="btn btn-outline-light btn-lg"
            role="button"
            onClick={async (e) => {
              e.preventDefault();
              await test_api(true);
            }}
          >Test (Admin)</a>
          <p>{feedbackAdmin}</p>
          <br />

          {errorMsg && <p className="error">{errorMsg}</p>}
        </div>
        <Spacer />
        <style jsx>{`
          .content {
            max-width: 40rem;
            margin: 0 auto;
            padding: 2rem 4rem;
            border: 1px solid #ccc;
            border-radius: 4px;
          }
          .error {
            color: red;
            margin: 1rem 0 0;
          }
        `}</style>
      </Padding>
    </Layout>
  )
}
