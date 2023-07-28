import Button from "react-bootstrap/Button"

export default function LoginForm({
  errorMessage,
  onSubmit,
  cancelFunction,
}) {
  return (
    <form onSubmit={onSubmit}>
      <label>
        <span>Username</span>
        <input type="text" name="username" required autoComplete="username" />
      </label>
      <label>
        <span>Password</span>
        <input type="password" name="password" required autoComplete="current-password" />
      </label>

      <div className="login_buttons">
        <Button 
          style={{width: "100%"}}
          variant="outline-light"
          type="submit"
          >
          Login
        </Button>
        {cancelFunction && <div style={{width: "0.5em"}}></div>}
        {cancelFunction && 
        <Button 
          style={{width: "100%"}}
          variant="outline-light"
          onClick={cancelFunction}
          >
          Cancel
        </Button>}
        
      </div>

      {errorMessage && <p className="error">{errorMessage}</p>}

      <style jsx>{`
        form,
        label {
          display: flex;
          flex-flow: column;
        }
        label > span {
          font-weight: 600;
        }
        input {
          padding: 8px;
          margin: 0.3rem 0 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
        }
        .error {
          color: red;
          margin: 1rem 0 0;
        }
        .login_buttons {
          display: flex
        }
      `}</style>
    </form>
  );
}
