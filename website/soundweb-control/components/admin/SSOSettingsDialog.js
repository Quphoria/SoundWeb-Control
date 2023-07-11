import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import BTable from 'react-bootstrap/Table';
import FormCheck from 'react-bootstrap/FormCheck';
import useSWR from "swr";

const api_admin_sso_keys = "/api/admin/sso_keys";
const api_admin_sso_apps = "/api/admin/sso_apps";

function SSOAppRow(app, mutateSSOApps) {
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
          fetch(api_admin_sso_apps, {
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
    <td>
      <Button variant="danger" size="sm" onClick={() => {
        if (!confirm(`Are you sure you want to remove the ${app.id} app?\nYou can get this option back by re-signing into the SSO app.`)) {
          return;
        }
        fetch(api_admin_sso_apps, {
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

  const { data: public_key, mutate: mutatePublicKey } = useSWR(api_admin_sso_keys, url => fetch(url, {method: 'POST'}).then(res => res.text()));
  const { data: SSOApps, mutate: mutateSSOApps } = useSWR(api_admin_sso_apps, url => fetch(url, {method: 'POST'}).then(res => res.json()));

  const handleClose = () => setState({show: false});

  const handleGenerate = async () => {
    if (!confirm("Are you sure you want to generate new SSO keys?\nTHIS WILL BREAK ALL SSO APPS!!!")) {
      return;
    }
    fetch(api_admin_sso_keys, {
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

  return (<Modal show={state.show} onHide={handleClose} className="text-dark" size="lg">
    <Modal.Dialog style={{margin: 0}} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>SSO Settings</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <h5>SSO Public Key:</h5>
        <code><textarea style={{width: "100%", height: "15em"}} value={public_key} readOnly={true}/></code> 
        <h5>SSO Apps:</h5>
        <BTable striped hover size="sm" variant="light">
          <thead>
            <tr>
              <th>App</th>
              <th></th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SSOApps ? SSOApps.map((app) => SSOAppRow(app, mutateSSOApps)) : [(
              <tr key={"empty"}>
                <td colSpan={3}>No Apps</td>
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
  </Modal>);
}

export default SSOSettingsDialog;