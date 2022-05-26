import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'

function DeleteConfirmation(props) {
  const { state, setState } = props;

  const handleClose = () => setState({show: false});
  const handleConfirm = () => {
    state.onConfirm && state.onConfirm();
    handleClose();
  }

  return (<Modal show={state.show} onHide={handleClose} className="text-dark">
    <Modal.Dialog style={{margin: 0}}>
      <Modal.Header closeButton>
        <Modal.Title>Warning</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        {state.body}
      </Modal.Body>
    
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
        <Button variant="danger" onClick={handleConfirm}>Delete</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default DeleteConfirmation;