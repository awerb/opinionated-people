import type { ChangeEvent } from "react";
import type { GameParticipant } from "../../types/GameModels";

import "./GameLobby.css";

interface GameLobbyProps {
  participants: GameParticipant[];
  finalistThreshold: number;
  onFinalistThresholdChange: (value: number) => void;
  onToggleElimination: (id: string) => void;
  onPromoteFinalist: (id: string) => void;
  onRevokeFinalist: (id: string) => void;
}

const formatRole = (participant: GameParticipant) => {
  if (participant.finalist) {
    return "Finalist";
  }
  if (participant.voterOnly) {
    return "Voter";
  }
  return "Competitor";
};

const GameLobby = ({
  participants,
  finalistThreshold,
  onFinalistThresholdChange,
  onToggleElimination,
  onPromoteFinalist,
  onRevokeFinalist,
}: GameLobbyProps) => {
  const handleThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const parsed = Number(event.target.value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      onFinalistThresholdChange(parsed);
    }
  };

  return (
    <section className="game-lobby">
      <header className="game-lobby__header">
        <div>
          <p className="eyebrow">Admin controls</p>
          <h2>Game lobby</h2>
          <p className="subtle">Select finalists and manage eliminations before locking the finals bracket.</p>
        </div>
        <label className="threshold-input">
          <span>Finalists:</span>
          <input type="number" min={1} value={finalistThreshold} onChange={handleThresholdChange} />
        </label>
      </header>
      <table className="roster-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Score</th>
            <th>Status</th>
            <th aria-label="admin" />
          </tr>
        </thead>
        <tbody>
          {participants.map((participant) => {
            const rowClassNames = ["roster-row"];
            if (participant.eliminated) {
              rowClassNames.push("is-eliminated");
            } else if (participant.finalist) {
              rowClassNames.push("is-finalist");
            }

            return (
              <tr key={participant.id} className={rowClassNames.join(" ")}>
                <td>
                  <div className="player-name">
                    <span>{participant.displayName}</span>
                    {participant.eliminated && <small>Eliminated</small>}
                  </div>
                </td>
                <td>{participant.score}</td>
                <td>{formatRole(participant)}</td>
                <td>
                  <div className="row-actions">
                    <button type="button" onClick={() => onToggleElimination(participant.id)}>
                      {participant.eliminated ? "Reinstate" : "Eliminate"}
                    </button>
                    {participant.finalist ? (
                      <button type="button" onClick={() => onRevokeFinalist(participant.id)}>
                        Remove finalist
                      </button>
                    ) : (
                      <button type="button" onClick={() => onPromoteFinalist(participant.id)} disabled={participant.eliminated}>
                        Promote
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
};

export default GameLobby;
