import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import useSWR from "swr";

const api_sso_keys = "/api/admin/sso_keys";

function SSOSettingsDialog(props) {
  const { state, setState } = props;

  const { data: public_key, mutate: mutatePublicKey } = useSWR(api_sso_keys, url => fetch(url, {method: 'POST'}).then(res => res.text()));

  const handleClose = () => setState({show: false});

  const handleGenerate = async () => {
    if (!confirm("Are you sure you want to generate new SSO keys?\nTHIS WILL BREAK ALL SSO APPS!!!")) {
      return;
    }
    fetch(api_sso_keys, {
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
        <code><textarea style={{width: "100%", height: "15em"}} value={public_key}/></code>
        
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