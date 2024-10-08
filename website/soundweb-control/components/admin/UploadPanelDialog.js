import { useEffect, useRef, useState } from 'react';
import Modal from 'react-bootstrap/Modal'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import FormCheck from 'react-bootstrap/FormCheck';

import { tab_count, has_panel_errors } from '../../PanelContents';
import { api_admin_restart_url, api_admin_panel_upload_url, api_admin_panel_restore_url, api_admin_panel_errors_url, home_url } from '../../lib/siteUrls';

const toBase64 = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

function UploadPanelDialog(props) {
  const { state, setState } = props;
  const [hasFile, setHasFile] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  const fileRef = useRef(null);

  const handleClose = () => setState({show: false});
  const handleRestart = () => {
    if (!confirm("Are you sure you want to restart the webserver?")) {
      handleClose();
      return;
    }
    fetch(api_admin_restart_url, {
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
        window.location = home_url;
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
    fetch(api_admin_panel_upload_url, {
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
        window.location = home_url;
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
    fetch(api_admin_panel_restore_url, {
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
        window.location = home_url;
        return;
      };

      r.text().then(msg => {
        console.log(msg);
        setState({...state, errorMessage: msg});
      });
    })
  }
  const handleShowErrors = async (show) => {
    if (!confirm("Are you sure you want to show/hide errors on the panel?\nTHIS WILL CAUSE THE SERVER TO RESTART!")) {
      handleClose();
      return false;
    }
    return await fetch(api_admin_panel_errors_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({show_panel_errors: show})
    })
    .then(r => {
      if (r.ok) {
        handleClose();
        alert("Server restarting due to panel errors setting change");
        window.location = home_url;
        return true;
      };

      r.text().then(msg => {
        console.log(msg);
        setState({...state, errorMessage: msg});
      });
    });
  }

  const loadShowPanelErrors = async () => {
    const show_panel_errors = await fetch(api_admin_panel_errors_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    })
    .then(r => {
      if (r.ok) {
        return r.json().then(({show_panel_errors}) => show_panel_errors);
      }
    });
    setShowErrors(show_panel_errors === true);
  } 

  // get show panel errors state
  useEffect(() => { loadShowPanelErrors() }, [])

  const fileChange = () => {
    setHasFile(fileRef.current?.files[0] !== undefined);
  }

  return (<Modal show={state.show} onHide={handleClose} className="text-dark">
    <Modal.Dialog style={{margin: 0}}>
      <Modal.Header closeButton>
        <Modal.Title>Panel Upload</Modal.Title>
      </Modal.Header>
    
      <Modal.Body>
        <Button variant="primary" onClick={handleRestore} hidden={!(has_panel_errors || (tab_count < 0))} style={{marginBottom: "1rem"}}>Restore Last Working Panel File</Button>
        <div hidden={!has_panel_errors}>
          <FormCheck 
            type="switch"
            label="Show panel controls with errors"
            checked={showErrors}
            onChange={async () => {
              const r = await handleShowErrors(!showErrors);
              if (r === true) setShowErrors(!showErrors);
            }}
          />
        </div>
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