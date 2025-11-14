function App() {
  const handleStart = () => {
    console.log("Start game clicked");
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}>
        <h1>Opinionated People</h1>
        <p>Prototype build</p>
        <button onClick={handleStart} style={{ padding: "1rem 2rem", fontSize: "1.1rem", marginTop: "1rem" }}>
          Start Game
        </button>
      </div>
    </div>
  );
}

export default App;
