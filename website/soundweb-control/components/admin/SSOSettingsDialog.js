import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import BTable from 'react-bootstrap/Table';
import FormCheck from 'react-bootstrap/FormCheck';
import useSWR from "swr";

import { api_admin_sso_keys_url, api_admin_sso_apps_url } from '../../lib/siteUrls';
import { useState } from 'react';
import { Col, Form, Row } from 'react-bootstrap';

function SSOAppRow(app, mutateSSOApps, setListingInfo) {
  return (<tr key={`app-${app.id}`}>
    <td style={{paddingLeft: "0.5em"}}>
      <code>{app.id}</code>
    </td>
    <td>
      <FormCheck 
        type="switch"
        label={!app.disabled ? "Enabled" : "Disabled"}
        defaultChecked={!app.disabled}
        onChange={(e) => {
          const checked = e.target.checked;
          fetch(api_admin_sso_apps_url, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sso_app_id: app.id,
              action: checked ? "enable" : "disable"
            })
          }).then(() => mutateSSOApps());
        }}
      />
    </td>
    <td className="text-center">
      {app.listed && app.listName && app.listUrl && "Listed"}
    </td>
    <td className="d-flex justify-content-end">
      <Button className="me-2" variant="primary" size="sm" onClick={() => setListingInfo(app)}>
        App Listing
      </Button>
      <Button variant="danger" size="sm" onClick={() => {
        if (!confirm(`Are you sure you want to remove the ${app.id} app?\nYou can get this option back by re-signing into the SSO app.`)) {
          return;
        }
        fetch(api_admin_sso_apps_url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sso_app_id: app.id,
            action: "delete"
          })
        }).then(() => mutateSSOApps());
      }}>
        Delete
      </Button>
    </td>
  </tr>);
}

function SSOSettingsDialog(props) {
  const { state, setState } = props;

  const { data: public_key, mutate: mutatePublicKey } = useSWR(api_admin_sso_keys_url, url => fetch(url, {method: 'POST'}).then(res => res.text()));
  const { data: SSOApps, mutate: mutateSSOApps } = useSWR(api_admin_sso_apps_url, url => fetch(url, {method: 'POST'}).then(res => res.json()));

  const handleClose = () => setState({show: false});

  const handleGenerate = async () => {
    if (!confirm("Are you sure you want to generate new SSO keys?\nTHIS WILL BREAK ALL SSO APPS!!!")) {
      return;
    }
    fetch(api_admin_sso_keys_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        generate: true
      })
    })
    .then(r => {
      if (r.ok) {
        mutatePublicKey();
        return;
      };

      r.text().then(msg => {
        console.log(msg);
        setState({...state, errorMessage: msg});
      });
    })
  }

  const [listingInfo, setListingInfo] = useState({
    id: null,
    listed: false,
    listName: "",
    listUrl: "",
  });

  return (<>
    <Modal show={state.show && !listingInfo.id} onHide={handleClose} className="text-dark" size="lg">
      <Modal.Dialog style={{margin: 0}} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>SSO Settings</Modal.Title>
        </Modal.Header>
      
        <Modal.Body>
          <h5>SSO Public Key:</h5>
          <code><textarea style={{width: "100%", height: "15em"}} value={public_key} readOnly={true}/></code> 
          <p></p>
          <h5>SSO Apps:</h5>
          <BTable striped hover size="sm" variant="light" className="align-middle">
            <thead>
              <tr>
                <th>App</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {SSOApps ? SSOApps.map((app) => SSOAppRow(app, mutateSSOApps, setListingInfo)) : [(
                <tr key={"empty"}>
                  <td colSpan={6}>No Apps</td>
                </tr>
              )]}
            </tbody>
          </BTable>
        </Modal.Body>
      
        <Modal.Footer>
          <a onClick={handleGenerate} style={{textDecoration: "underline", cursor: "pointer", color: "var(--bs-danger)", marginRight: "auto"}}>
            Generate new keypair
          </a>
          <Button variant="secondary" onClick={handleClose}>Close</Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal>

    <Modal show={!!listingInfo.id} onHide={() => setListingInfo(o => ({...o, id: null}))} className="text-dark" size="md">
      <Modal.Dialog style={{margin: 0}} size="md">
        <Modal.Header closeButton>
          <Modal.Title>SSO App Settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group as={Row} className="mb-2">
            <Form.Label column sm={3}>App ID</Form.Label>
            <Col sm={9}>
              <Form.Control type="text" value={listingInfo?.id} disabled />
            </Col>
          </Form.Group>
          
          <hr />

          <Form.Group as={Row} className="mb-2">
            <Form.Label column sm={3}>Listed</Form.Label>
            <Col sm={4} className="align-content-center">
              <FormCheck 
                type="switch"
                label={(listingInfo?.listed && listingInfo?.listName && listingInfo?.listUrl) ? "Visible" : "Hidden"}
                defaultChecked={listingInfo?.listed}
                disabled={!listingInfo?.listName || !listingInfo?.listUrl}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setListingInfo(o => ({...o, listed: checked}));
                }}
              />
            </Col>
            {
              listingInfo?.listName ? (listingInfo?.listUrl ? <></> : (
                <Form.Label column sm={5} className="text-danger fst-italic fw-bold">Missing URL</Form.Label>
              )) : (
                <Form.Label column sm={5} className="text-danger fst-italic fw-bold">Missing Name</Form.Label>
              )
            }
          </Form.Group>

          <Form.Group as={Row} className="mb-2">
            <Form.Label column sm={3}>Name</Form.Label>
            <Col sm={9}>
              <Form.Control type="text" value={listingInfo?.listName} onChange={(e) => {
                const value = e.target.value;
                setListingInfo(o => ({...o, listName: value}));
              }} />
            </Col>
          </Form.Group>

          <Form.Group as={Row} className="mb-2">
            <Form.Label column sm={3}>URL</Form.Label>
            <Col sm={9}>
              <Form.Control type="text" value={listingInfo?.listUrl} onChange={(e) => {
                const value = e.target.value;
                setListingInfo(o => ({...o, listUrl: value}));
              }} />
            </Col>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setListingInfo(o => ({...o, id: null}))}>Close</Button>
          <Button variant="success" onClick={() => {
            const id = listingInfo?.id;
            if (!id) {
              setListingInfo(o => ({...o, id: null}));
              return;
            }

            fetch(api_admin_sso_apps_url, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                sso_app_id: id,
                action: "listing",
                listed: listingInfo?.listed,
                listName: listingInfo?.listName,
                listUrl: listingInfo?.listUrl,
              })
            }).then(() => {
              setListingInfo(o => ({...o, id: null}));
              mutateSSOApps();
            });
          }}>Save</Button>
        </Modal.Footer>
      </Modal.Dialog>
    </Modal>
  </>);
}

export default SSOSettingsDialog;