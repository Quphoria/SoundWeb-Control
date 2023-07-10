import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import BTable from 'react-bootstrap/Table';
import FormCheck from 'react-bootstrap/FormCheck';

const api_admin_user_sso_apps = "/api/admin/user_sso_apps";

function SSOAppRow(app_id, app_enabled, user_id, username, onChange) {
  return (<tr key={`app-${app_id}`}>
    <td style={{paddingLeft: "0.5em"}}>
      {app_id}
    </td>
    <td>
      <FormCheck 
        type="switch"
        label={app_enabled == "enabled" ? "Enabled" : "Disabled"}
        checked={app_enabled == "enabled"}
        defaultChecked={false}
        onChange={(e) => {
          const checked = e.target.checked;
          fetch(api_admin_user_sso_apps, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: user_id,
              sso_app_id: app_id,
              action: checked ? "enable" : "disable"
            })
          }).then(() => onChange());
        }}
      />
    </td>
    <td>
      <Button variant="danger" size="sm" onClick={() => {
        if (!confirm(`Are you sure you want to remove the ${app_id} app for user ${username}?\nYou can get this option back by re-signing into the SSO app.`)) {
          return;
        }
        fetch(api_admin_user_sso_apps, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: user_id,
            sso_app_id: app_id,
            action: "delete"
          })
        }).then(() => onChange());
      }}>
        Delete
      </Button>
    </td>
  </tr>);
}

function SSOAppsDialog(props) {
  const { state, setState } = props;

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
              <th></th>
            </tr>
          </thead>
          <tbody>
            {state.SSOApps ? Object.keys(state.SSOApps).map((app_id) => SSOAppRow(app_id, state.SSOApps[app_id], state.user_id, state.username, state.onChange)) : []}
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