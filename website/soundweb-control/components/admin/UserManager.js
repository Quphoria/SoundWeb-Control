import Button from "react-bootstrap/Button"
import BTable from 'react-bootstrap/Table';
import FormCheck from 'react-bootstrap/FormCheck';
import FormControl from 'react-bootstrap/FormControl'
import useSWR from "swr";
import { useState, useRef } from "react";

import { tab_count } from "../../PanelContents";
import DeleteConfirmation from "./DeleteConfirmation";
import InfoModal from "../InfoModal";
import ChangePasswordDialog from "./ChangePasswordDialog";
import AddUserDialog from "./AddUserDialog";

const api_admin_users = "/api/admin/users";
const api_admin_password = "/api/admin/password";

function onTableChange(e, id, key, users, mutateUsers, hiddenTabs=[]) {
  const value = e.target.value.trim();
  const checked = e.target.checked;

  const new_data = {};
  switch (key) {
    case "username":
      new_data[key] = value;
      break;
    case "admin":
    case "disabled":
      new_data[key] = checked;
      break;
    case "hiddenTabs":
      if (checked) {
        var new_hiddenTabs = hiddenTabs;
        if (hiddenTabs.indexOf(value) === -1) {
          new_hiddenTabs.push(value)
        }
        new_data[key] = new_hiddenTabs.sort((a, b) => a - b);
      } else {
        new_data[key] = hiddenTabs.filter(x => x !== value).sort((a, b) => a - b);
      }
      break;
  }
  var new_users = users;
  Object.assign(new_users[id], new_data);
  fetch(api_admin_users, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id,
      data: new_data
    })
  }).then(() => mutateUsers());
}

function formatDate(date) {
  return date == "Unknown" ? "Unknown" : new Date(date).toLocaleString()
}

function generateTableRow(user, current_user, users, mutateUsers, setDeleteModalState, setInfoModalState, setChangePasswordModalState) {
  var tab_buttons = [];
  for(var i = 0; i < tab_count; i++) {
    tab_buttons.push((
      <FormCheck
        key={`${user.id}-tabhidden-${i}`}
        label={`${i}`}
        value={`${i}`}
        defaultChecked={!user.admin && user.hiddenTabs.includes(String(i))}
        style={{
          display: "inline-block",
          marginRight: "1.5em"
        }}
        disabled={user.admin}
        onChange={(e) => onTableChange(e, user.id, "hiddenTabs", users, mutateUsers, user.hiddenTabs)}
      />
    ))
  }

  return (<tr key={`user-${user.id}`}>
    <td style={{paddingLeft: "0.5em"}}>
      {user.id}
    </td>
    <td>
      <FormControl
        type="text"
        size="sm"
        onChange={(e) => onTableChange(e, user.id, "username", users, mutateUsers)}
        defaultValue={user.username}
        readOnly={user.id === current_user.id}
      />
    </td>
    <td>{user.password}</td>
    <td>
      <FormCheck 
        type="switch"
        label={user.admin ? "Admin" : "User"}
        defaultChecked={user.admin}
        disabled={user.id === current_user.id}
        onChange={(e) => onTableChange(e, user.id, "admin", users, mutateUsers)}
      />
    </td>
    <td>
      <FormCheck 
        type="switch"
        label="Disabled"
        defaultChecked={user.disabled}
        disabled={user.id === current_user.id}
        onChange={(e) => onTableChange(e, user.id, "disabled", users, mutateUsers)}
      />
    </td>
    <td>
      {tab_buttons}
    </td>
    <td>
      <Button variant="info" size="sm" onClick={() => {
        setInfoModalState({
          show: true,
          title: "User Info",
          body: (<p>
            <b>ID: </b>{user.id} <br />
            <b>Username: </b>{user.username} <br />
            <b>Created: </b>{formatDate(user.dateCreated)} <br />
            <b>Changed: </b>{formatDate(user.lastChange)} <br />
            <b>Last Login: </b>{formatDate(user.lastLogin)}
          </p>)
        });
      }}
          style={{marginRight: "0.2em"}}>
        Info
      </Button>
      <Button variant="primary" size="sm" onClick={() => {
            setChangePasswordModalState({
              show: true,
              body: (<p>Are you sure you want to delete user <b>{user.username}</b>?</p>),
              username: user.username,
              hide: user.id === current_user.id,
              onConfirm: (password) => {
                fetch(api_admin_password, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    id: user.id,
                    password: password
                  })
                }).then(() => mutateUsers());
              }
            });
          }}
          style={{marginRight: "0.2em"}}>
        Change Password
      </Button>
      <Button variant="danger" size="sm" disabled={user.id === current_user.id} onClick={() => {
        setDeleteModalState({
          show: true,
          body: (<p>Are you sure you want to delete user <b>{user.username}</b>?</p>),
          onConfirm: () => {
            fetch(api_admin_users, {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                id: user.id
              })
            }).then(() => mutateUsers());
          }
        });
      }}>
        Delete
      </Button>
    </td>
  </tr>)
}

export default function UserManager({
  user
}) {
  const { data: users, mutate: mutateUsers } = useSWR(api_admin_users, url => fetch(url, {method: 'POST'}).then(res => res.json()));
  const [deleteModalState, setDeleteModalState] = useState({show: false});
  const [infoModalState, setInfoModalState] = useState({show: false});
  const [changePasswordModalState, setChangePasswordModalState] = useState({show: false});
  const [addUserModalState, setAddUserModalState] = useState({show: false});

  return (
    <form onSubmit={e => {e.preventDefault()}}>
      <DeleteConfirmation state={deleteModalState} setState={setDeleteModalState} />
      <InfoModal state={infoModalState} setState={setInfoModalState} />
      <ChangePasswordDialog state={changePasswordModalState} setState={setChangePasswordModalState} />
      <AddUserDialog state={addUserModalState} setState={setAddUserModalState} />
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        marginBottom: "0.2em"
      }}>
        <h5 style={{margin: "auto auto 0.2em 0.2em"}}>Users</h5>
        <Button variant="success"  onClick={() => {
          setAddUserModalState({
            show: true,
            taken_usernames: users.map(user => user.username.toLowerCase()),
            onConfirm: (data) => {
              fetch(api_admin_users, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  data
                })
              }).then(() => mutateUsers());
            }
          })
        }}
            style={{marginRight: "0.2em"}}>
          Add
        </Button>
      </div>
      <BTable striped hover size="sm" variant="dark">
        <thead>
          <tr>
            <th></th>
            <th>Username</th>
            <th>Password</th>
            <th></th>
            <th></th>
            <th>Hidden Tabs</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users ? users.map(u => generateTableRow(u, user, users, mutateUsers, setDeleteModalState, setInfoModalState, setChangePasswordModalState)) :
            (<tr><td colSpan={6} style={{textAlign: "center"}}>Loading...</td></tr>)}
        </tbody>
      </BTable>
    </form>
  );
}
