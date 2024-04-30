import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import { Alert, FormCheck } from 'react-bootstrap';

function SupportDialog(props) {
  const { state, setState, info } = props;

  const handleClose = () => setState({show: false});

  return (<Modal show={state.show} onHide={handleClose} className="text-dark" size="lg">
    <Modal.Dialog style={{margin: 0}} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Support</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <p>For support on this system, please contact:</p>
        <b>{info.name}</b><br />
        <a href={"mailto:" + info.email} style={{color: "var(--bs-primary)"}} target="_blank">
          <i>{info.email}</i>
        </a>
      </Modal.Body>
    
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default SupportDialog;