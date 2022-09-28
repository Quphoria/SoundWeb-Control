import { useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

import { tab_count } from '../../PanelContents';

const api_restart = "/api/admin/restart";
const api_panel_upload = "/api/admin/panel_upload";
const api_panel_restore = "/api/admin/panel_restore";

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

function UploadPanelDialog(props) {
  const { state, setState } = props;
  const [hasFile, setHasFile] = useState(false);

  const fileRef = useRef(null);

  const handleClose = () => setState({show: false});
  const handleRestart = () => {
    if (!confirm("Are you sure you want to restart the webserver?")) {
      handleClose();
      return;
    }
    fetch(api_restart, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        restart: true
      })
    })
    .then(r => {
      handleClose();
      if (r.ok) {
        alert("Webserver restarting...");
        window.location = "/";
        return;
      };
    })
  }
  const handleUpload = async () => {
    const file = fileRef.current?.files[0];
    if (file === undefined) {
      setState({...state, errorMessage: "No file chosen"});
      return;
    }
    if (!file.name.endsWith(".panel")) {
      setState({...state, errorMessage: "File must be a .panel file"});
      fileRef.current.value = null;
      return;
    }
    const base64 = await toBase64(file);

    if (!confirm("Are you sure you want to upload a new panel file?\nTHIS WILL OVERWRITE THE CURRENT PANEL FILE!!!")) {
      handleClose();
      return;
    }
    fetch(api_panel_upload, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filename: file.name,
        data: base64
      })
    })
    .then(r => {
      fileRef.current.value = null;
      if (r.ok) {
        handleClose();
        alert("Server restarting due to panel file change");
        window.location = "/";
        return;
      };

      r.text().then(msg => {
        console.log(msg);
        setState({...state, errorMessage: msg});
      });
    })
  }
  const handleRestore = async () => {
    if (!confirm("Are you sure you want to restore the last working panel file?\nTHIS WILL OVERWRITE THE CURRENT PANEL FILE!!!")) {
      handleClose();
      return;
    }
    fetch(api_panel_restore, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        restore: true
      })
    })
    .then(r => {
      if (r.ok) {
        handleClose();
        alert("Server restarting due to panel file change");
        window.location = "/";
        return;
      };

      r.text().then(msg => {
        console.log(msg);
        setState({...state, errorMessage: msg});
      });
    })
  }

  const fileChange = () => {
    setHasFile(fileRef.current?.files[0] !== undefined);
  }

  return (<Modal show={state.show} onHide={handleClose} className="text-dark">
    <Modal.Dialog style={{margin: 0}}>
      <Modal.Header closeButton>
        <Modal.Title>Panel Upload</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <Button variant="primary" onClick={handleRestore} hidden={tab_count >= 0} style={{marginBottom: "1rem"}}>Restore Last Working Panel File</Button>
        <form>
          <Form.Group className="mb-3">
            <Form.Label>New .panel file</Form.Label>
            <Form.Control type="file" required onChange={fileChange}
              accept=".panel"
              ref={fileRef} />
          </Form.Group>
          <p style={{color: "red", margin: "1rem 0 0"}}>
            {state.errorMessage}
          </p>
        </form>
      </Modal.Body>
    
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
        <Button variant="warning" onClick={handleRestart}>Restart Server</Button>
        <Button variant="danger" onClick={handleUpload} disabled={!hasFile}>Upload Panel File</Button>
      </Modal.Footer>
    </Modal.Dialog>
  </Modal>);
}

export default UploadPanelDialog;