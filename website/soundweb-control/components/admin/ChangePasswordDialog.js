import { useRef } from 'react';
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

function ChangePasswordDialog(props) {
  const { state, setState } = props;

  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleClose = () => setState({show: false});
  const handleConfirm = () => {
    if (passwordRef.current && confirmPasswordRef.current) {
      const password = passwordRef.current.value;
      const confirmPassword = confirmPasswordRef.current.value;
      if (!password) {
        setState({...state, errorMessage: "Password cannot be empty"});
        return;
      }
      if (password !== password.trim()) {
        setState({...state, errorMessage: "Password starts/ends with whitespace"});
        return;
      }
      if (password !== confirmPassword) {
        setState({...state, errorMessage: "Passwords do not match"});
        return;
      }
      state.onConfirm && state.onConfirm(password);
    }
    handleClose();
  }

  return (<Modal show={state.show} onHide={handleClose} className="text-dark">
    <Modal.Dialog style={{margin: 0}}>
      <Modal.Header closeButton>
        <Modal.Title>Change password</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <p><b>User: </b>{state.username}</p>
        <form onSubmit={(e) => {e.preventDefault(); handleConfirm()}}>
          <input type="text" style={{display: "none"}} autoComplete='username' defaultValue={state.username}></input>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type={state.hide ? "password" : "text"} placeholder="Password" required
              ref={passwordRef} autoComplete={state.hide ? "new-password" : "off"} onKeyDown={(e) => {
                if (e.key == "Enter") {
                  confirmPasswordRef.current?.focus();
                }
              }} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Confirm Password</Form.Label>
            <Form.Control type={state.hide ? "password" : "text"} placeholder="Confirm Password" required
              ref={confirmPasswordRef} autoComplete={state.hide ? "new-password" : "off"} onKeyDown={(e) => {
                if (e.key == "Enter") {
                  handleConfirm();
                }
              }} />
          </Form.Group>
          <p style={{color: "red", margin: "1rem 0 0"}}>
            {state.errorMessage}
          </p>
        </form>
      </Modal.Body>
    
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
        <Button variant="primary" onClick={handleConfirm}>Change</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default ChangePasswordDialog;