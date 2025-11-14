import "./components.css";

export type LeaderboardEntry = {
  id: string;
  player: string;
  wins: number;
  winRate: number;
  streak: number;
};

export type LeaderboardProps = {
  entries: LeaderboardEntry[];
  title?: string;
};

const Leaderboard = ({ entries, title = "Weekly Leaders" }: LeaderboardProps) => {
  return (
    <section className="panel">
      <header className="panel__header">
        <div>
          <p className="panel__eyebrow">Community</p>
          <h2>{title}</h2>
        </div>
        <span className="panel__tag">Top {entries.length}</span>
      </header>
      <div className="leaderboard">
        {entries.map((entry, index) => (
          <article key={entry.id} className="leaderboard__row">
            <span className="leaderboard__rank">#{index + 1}</span>
            <div className="leaderboard__player">
              <p className="leaderboard__name">{entry.player}</p>
              <p className="leaderboard__meta">{entry.winRate}% win rate</p>
            </div>
            <div className="leaderboard__stats">
              <span className="leaderboard__stat">
                <strong>{entry.wins}</strong>
                <span>Wins</span>
              </span>
              <span className="leaderboard__stat">
                <strong>{entry.streak}</strong>
                <span>Streak</span>
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default Leaderboard;
