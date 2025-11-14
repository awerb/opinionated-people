import type { GameParticipant } from "../../types/GameModels";

import "./ChampionshipBoard.css";

interface ChampionshipBoardProps {
  finalists: GameParticipant[];
  winnerId: string | null;
  onSelectWinner?: (id: string) => void;
  isAdmin?: boolean;
}

const ChampionshipBoard = ({ finalists, winnerId, onSelectWinner, isAdmin = false }: ChampionshipBoardProps) => {
  if (!finalists.length) {
    return (
      <section className="championship-board empty">
        <p>No finalists yet. Promote players from the lobby to populate the bracket.</p>
      </section>
    );
  }

  return (
    <section className="championship-board">
      <header>
        <p className="eyebrow">Championship</p>
        <h2>Final showdown</h2>
        {winnerId ? <p className="winner-announcement">🏆 Winner: {finalists.find((f) => f.id === winnerId)?.displayName}</p> : <p className="subtle">Tap a finalist to announce the winner.</p>}
      </header>
      <div className="finalist-grid">
        {finalists.map((finalist) => {
          const cardClassNames = ["finalist-card"];
          if (winnerId === finalist.id) {
            cardClassNames.push("is-winner");
          }

          return (
            <button
              type="button"
              key={finalist.id}
              className={cardClassNames.join(" ")}
              disabled={!isAdmin}
              onClick={() => onSelectWinner?.(finalist.id)}
            >
              <span className="finalist-name">{finalist.displayName}</span>
              <span className="finalist-score">{finalist.score} pts</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ChampionshipBoard;
