import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import { Alert, FormCheck } from 'react-bootstrap';

function BackendDebugDialog(props) {
  const { state, setState, connected, debug, setDebug, reconnectCallback } = props;

  const handleClose = () => setState({show: false});

  return (<Modal show={state.show} onHide={handleClose} className="text-dark" size="lg">
    <Modal.Dialog style={{margin: 0}} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Backend Debug</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <Alert variant="danger">
          This should only be touched by a trained technician, <br />
          enabling this feature WILL cause performance issues, <br />
          only enable this when instructed by support.
        </Alert>
        <p>Enabling debug will increase the amount of information logged to STDOUT by the backend</p>
        <FormCheck 
          type="switch"
          label={"Debug"}
          checked={debug}
          disabled={!connected}
          onChange={(e) => setDebug && setDebug(e.target.checked)}
        />
        <br />
        <p>Pressing reconnect will trigger all HiQnet connections to get restarted (this takes about 10 seconds)</p>
        <Button variant="danger" disabled={!connected} onClick={reconnectCallback}>Reconnect</Button>
      </Modal.Body>
    
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default BackendDebugDialog;