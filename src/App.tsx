import { useMemo, useState } from "react";
import ChampionshipBoard from "./frontend/components/ChampionshipBoard";
import GameLobby from "./frontend/pages/GameLobby";
import type { GameParticipant, GamePhase } from "./types/GameModels";
import "./App.css";

const initialParticipants: GameParticipant[] = [
  { id: "ada", displayName: "Ada", score: 32, eliminated: false, finalist: false, voterOnly: false },
  { id: "linus", displayName: "Linus", score: 24, eliminated: false, finalist: false, voterOnly: false },
  { id: "ye", displayName: "Ye", score: 27, eliminated: false, finalist: false, voterOnly: false },
  { id: "molly", displayName: "Molly", score: 29, eliminated: false, finalist: false, voterOnly: false },
  { id: "bianca", displayName: "Bianca", score: 25, eliminated: false, finalist: false, voterOnly: false },
  { id: "nico", displayName: "Nico", score: 20, eliminated: false, finalist: false, voterOnly: false },
];

function App() {
  const [phase, setPhase] = useState<GamePhase>("lobby");
  const [finalistThreshold, setFinalistThreshold] = useState(3);
  const [participants, setParticipants] = useState(initialParticipants);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  const finalists = useMemo(() => participants.filter((participant) => participant.finalist && !participant.eliminated), [participants]);
  const readyForFinals = finalists.length >= finalistThreshold;

  const updateParticipant = (id: string, updater: (participant: GameParticipant) => GameParticipant) => {
    setParticipants((current) => current.map((participant) => (participant.id === id ? updater(participant) : participant)));
  };

  const handleToggleElimination = (id: string) => {
    updateParticipant(id, (participant) => ({
      ...participant,
      eliminated: !participant.eliminated,
      finalist: participant.eliminated ? participant.finalist : false,
      voterOnly: participant.eliminated ? participant.voterOnly : false,
    }));
  };

  const handlePromoteFinalist = (id: string) => {
    updateParticipant(id, (participant) => ({ ...participant, finalist: true, voterOnly: false }));
  };

  const handleRevokeFinalist = (id: string) => {
    updateParticipant(id, (participant) => ({ ...participant, finalist: false, voterOnly: true }));
  };

  const handlePhaseAdvance = () => {
    if (readyForFinals) {
      setPhase("championship");
    }
  };

  const handleResetFinals = () => {
    setWinnerId(null);
    setPhase("general");
  };

  const handleWinnerSelection = (id: string) => {
    setWinnerId(id);
    setPhase("complete");
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Opinionated People</p>
          <h1>Live finals control room</h1>
          <p className="subtle">Prototype admin tools for shepherding a round-based party game into the championship showdown.</p>
        </div>
        <div className="hero__actions">
          <span className={`phase-pill phase-${phase}`}>{phase.toUpperCase()}</span>
          <button type="button" onClick={handlePhaseAdvance} disabled={!readyForFinals || phase === "championship" || phase === "complete"}>
            Lock finalists
          </button>
          <button type="button" onClick={handleResetFinals} disabled={phase === "lobby"}>
            Reset finals
          </button>
        </div>
      </header>
      <div className="game-layout">
        <GameLobby
          participants={participants}
          finalistThreshold={finalistThreshold}
          onFinalistThresholdChange={setFinalistThreshold}
          onToggleElimination={handleToggleElimination}
          onPromoteFinalist={handlePromoteFinalist}
          onRevokeFinalist={handleRevokeFinalist}
        />
        <ChampionshipBoard finalists={finalists} winnerId={winnerId} onSelectWinner={handleWinnerSelection} isAdmin={phase === "championship"} />
      </div>
    </div>
  );
}

export default App;
