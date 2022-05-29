import { useRef } from 'react';
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

function AddUserDialog(props) {
  const { state, setState } = props;

  const usernameRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);

  const handleClose = () => setState({show: false});
  const handleConfirm = () => {
    if (usernameRef.current &&
        passwordRef.current &&
        confirmPasswordRef.current) {
      const username = usernameRef.current.value;
      const password = passwordRef.current.value;
      const confirmPassword = confirmPasswordRef.current.value;
      if (!username) {
        setState({...state, errorMessage: "Username cannot be empty"});
        return;
      }
      if (username !== username.trim()) {
        setState({...state, errorMessage: "Username starts/ends with whitespace"});
        return;
      }
      if (state.taken_usernames && state.taken_usernames.includes(username.toLowerCase())) {
        setState({...state, errorMessage: "Username taken"});
        return;
      }
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
      state.onConfirm && state.onConfirm({
        username,
        password
      });
    }
    handleClose();
  }

  return (<Modal show={state.show} onHide={handleClose} className="text-dark">
    <Modal.Dialog style={{margin: 0}}>
      <Modal.Header closeButton>
        <Modal.Title>New User</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <form onSubmit={(e) => {e.preventDefault(); handleConfirm()}}>
        <Form.Group className="mb-3">
            <Form.Label>Username</Form.Label>
            <Form.Control type="text" placeholder="Username" required
              ref={usernameRef} autoComplete="off" onKeyDown={(e) => {
                if (e.key == "Enter") {
                  passwordRef.current?.focus();
                }
              }} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Password</Form.Label>
            <Form.Control type="text" placeholder="Password" required
              ref={passwordRef} autoComplete="off" onKeyDown={(e) => {
                if (e.key == "Enter") {
                  confirmPasswordRef.current?.focus();
                }
              }} />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Confirm Password</Form.Label>
            <Form.Control type="text" placeholder="Confirm Password" required
              ref={confirmPasswordRef} autoComplete="off" onKeyDown={(e) => {
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
        <Button variant="success" onClick={handleConfirm}>Add</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default AddUserDialog;