import InvitePage from "../frontend/pages/Invite";
import "./App.css";

function App() {
  return (
    <div className="app-shell">
      <header>
        <h1>Opinionated People</h1>
        <p>Build your dream roster with trusted invitations.</p>
      </header>
      <InvitePage />
    </div>
  );
}

export default App;
