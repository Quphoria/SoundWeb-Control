import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'

function InfoModal(props) {
  const { state, setState } = props;

  const handleClose = () => setState({show: false});

  return (<Modal show={state.show} onHide={handleClose} className="text-dark">
    <Modal.Dialog style={{margin: 0}}>
      <Modal.Header closeButton>
        <Modal.Title>{state.title}</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        {state.body}
      </Modal.Body>
    
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default InfoModal;