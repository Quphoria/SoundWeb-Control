import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import BTable from 'react-bootstrap/Table';
import FormCheck from 'react-bootstrap/FormCheck';
import useSWR from "swr";

const api_admin_user_sso_apps = "/api/admin/user_sso_apps";
const api_admin_sso_apps = "/api/admin/sso_apps";

function SSOAppRow(app, app_enabled, user_id, username, onChange) {
  return (<tr key={`app-${app.id}`}>
    <td style={{paddingLeft: "0.5em"}}>
      <code>{app.id}</code>
    </td>
    <td>
      <FormCheck 
        type="switch"
        label={app.disabled ? "App Disabled for all users" : (app_enabled ? "Enabled" : "Disabled")}
        disabled={app.disabled}
        defaultChecked={app_enabled && !app.disabled}
        onChange={(e) => {
          const checked = e.target.checked;
          fetch(api_admin_user_sso_apps, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: user_id,
              sso_app_id: app.id,
              action: checked ? "enable" : "disable"
            })
          }).then(() => onChange());
        }}
      />
    </td>
  </tr>);
}

function SSOAppsDialog(props) {
  const { state, setState } = props;

  const { data: SSOApps } = useSWR(api_admin_sso_apps, url => fetch(url, {method: 'POST'}).then(res => res.json()));

  const handleClose = () => setState({show: false});

  return (<Modal show={state.show} onHide={handleClose} className="text-dark">
    <Modal.Dialog style={{margin: 0}}>
      <Modal.Header closeButton>
        <Modal.Title>SSO Apps</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <p><b>User: </b>{state.username}</p>
        <BTable striped hover size="sm" variant="light">
          <thead>
            <tr>
              <th>App</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {SSOApps ? SSOApps.map((app) => SSOAppRow(app, state.enabledSSOApps?.includes(app.id), state.user_id, state.username, state.onChange)) : [(
              <tr key={"empty"}>
                <td colSpan={2}>No Apps</td>
              </tr>
            )]}
          </tbody>
        </BTable>
      </Modal.Body>
    
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default SSOAppsDialog;