import { useEffect, useMemo, useState } from "react";
import Leaderboard from "../components/Leaderboard";
import Badges from "../components/Badges";
import type { LeaderboardEntry } from "../components/Leaderboard";
import type { Badge } from "../components/Badges";

export type ActiveGame = {
  id: string;
  opponent: string;
  topic: string;
  remainingSeconds: number;
  status: "your-turn" | "awaiting" | "completed";
};

export type Invite = {
  id: string;
  from: string;
  topic: string;
  expiresAt: string;
};

export type GameHistory = {
  id: string;
  opponent: string;
  topic: string;
  verdict: "win" | "loss" | "draw";
  playedAt: string;
};

type ProfileStats = {
  username: string;
  elo: number;
  winRate: number;
  debates: number;
  decisiveVotes: number;
  streak: number;
};

const initialProfile: ProfileStats = {
  username: "player-one",
  elo: 1500,
  winRate: 64,
  debates: 28,
  decisiveVotes: 14,
  streak: 3,
};

const Dashboard = () => {
  const [activeGames, setActiveGames] = useState<ActiveGame[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [profile, setProfile] = useState<ProfileStats>(initialProfile);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    // In lieu of a backend call we prime with representative data.
    setActiveGames([
      { id: "g-1", opponent: "Zuri", topic: "AI Governance", remainingSeconds: 5400, status: "your-turn" },
      { id: "g-2", opponent: "Theo", topic: "Mars Colonies", remainingSeconds: 12600, status: "awaiting" },
    ]);
    setInvites([
      { id: "i-1", from: "Mo", topic: "Crypto Regulation", expiresAt: "in 2h" },
      { id: "i-2", from: "Ivy", topic: "Gene Editing Ethics", expiresAt: "in 6h" },
    ]);
    setHistory([
      { id: "h-1", opponent: "Nika", topic: "Universal Basic Income", verdict: "win", playedAt: "Yesterday" },
      { id: "h-2", opponent: "Sami", topic: "Nuclear Energy", verdict: "loss", playedAt: "2 days ago" },
      { id: "h-3", opponent: "Jo", topic: "Remote Work", verdict: "win", playedAt: "3 days ago" },
    ]);
    setProfile({ ...initialProfile, elo: 1524, debates: 31, decisiveVotes: 16, streak: 4 });
    setLeaderboard([
      { id: "l-1", player: "Nova", wins: 18, winRate: 78, streak: 6 },
      { id: "l-2", player: "Atlas", wins: 16, winRate: 71, streak: 4 },
      { id: "l-3", player: "Rune", wins: 14, winRate: 69, streak: 3 },
      { id: "l-4", player: "Zuri", wins: 13, winRate: 67, streak: 2 },
    ]);
    setBadges([
      { id: "b-1", name: "Closer", description: "Won 3 debates in a row", earnedAt: "today" },
      { id: "b-2", name: "Consensus Crafter", description: "Earned 10 decisive votes", earnedAt: "this week" },
      { id: "b-3", name: "Night Owl", description: "Finished a match after midnight", earnedAt: "last week" },
    ]);
  }, []);

  const nextTimer = useMemo(() => {
    if (!activeGames.length) return "—";
    const soonest = [...activeGames].sort((a, b) => a.remainingSeconds - b.remainingSeconds)[0];
    const hours = Math.floor(soonest.remainingSeconds / 3600);
    const minutes = Math.floor((soonest.remainingSeconds % 3600) / 60)
      .toString()
      .padStart(2, "0");
    return `${hours}h ${minutes}m`;
  }, [activeGames]);

  return (
    <main className="dashboard">
      <header className="dashboard__hero">
        <div>
          <p className="panel__eyebrow">Welcome back</p>
          <h1>Control room</h1>
          <p className="dashboard__subhead">
            Track live debates, respond to invites, and follow your climb in the community rankings.
          </p>
        </div>
        <div className="dashboard__stats">
          <div>
            <p>Next timer</p>
            <strong>{nextTimer}</strong>
          </div>
          <div>
            <p>Active games</p>
            <strong>{activeGames.length}</strong>
          </div>
          <div>
            <p>Invites</p>
            <strong>{invites.length}</strong>
          </div>
        </div>
      </header>

      <section className="grid grid--primary">
        <article className="panel">
          <header className="panel__header">
            <div>
              <p className="panel__eyebrow">You</p>
              <h2>Profile stats</h2>
            </div>
            <span className="panel__tag">{profile.username}</span>
          </header>
          <div className="profile-stats">
            <div>
              <p>Rating</p>
              <strong>{profile.elo}</strong>
            </div>
            <div>
              <p>Win rate</p>
              <strong>{profile.winRate}%</strong>
            </div>
            <div>
              <p>Debates</p>
              <strong>{profile.debates}</strong>
            </div>
            <div>
              <p>Decisive votes</p>
              <strong>{profile.decisiveVotes}</strong>
            </div>
            <div>
              <p>Streak</p>
              <strong>{profile.streak}</strong>
            </div>
          </div>
        </article>
        <article className="panel">
          <header className="panel__header">
            <div>
              <p className="panel__eyebrow">Invites</p>
              <h2>Awaiting response</h2>
            </div>
            <span className="panel__tag">{invites.length} open</span>
          </header>
          <ul className="list">
            {invites.map((invite) => (
              <li key={invite.id} className="list__item">
                <div>
                  <strong>{invite.from}</strong>
                  <p>{invite.topic}</p>
                </div>
                <span className="list__meta">Expires {invite.expiresAt}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>

      <section className="grid grid--secondary">
        <article className="panel">
          <header className="panel__header">
            <div>
              <p className="panel__eyebrow">Active games</p>
              <h2>Timers & turns</h2>
            </div>
            <span className="panel__tag">{activeGames.length} live</span>
          </header>
          <div className="table">
            {activeGames.map((game) => (
              <div key={game.id} className="table__row">
                <div>
                  <strong>{game.topic}</strong>
                  <p>vs {game.opponent}</p>
                </div>
                <span className={`status status--${game.status}`}>
                  {game.status === "your-turn" ? "Your turn" : game.status === "awaiting" ? "Waiting" : "Complete"}
                </span>
                <span className="table__meta">{Math.round(game.remainingSeconds / 3600)}h left</span>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <header className="panel__header">
            <div>
              <p className="panel__eyebrow">History</p>
              <h2>Recent verdicts</h2>
            </div>
            <span className="panel__tag">Last {history.length}</span>
          </header>
          <div className="table">
            {history.map((game) => (
              <div key={game.id} className="table__row">
                <div>
                  <strong>{game.topic}</strong>
                  <p>vs {game.opponent}</p>
                </div>
                <span className={`status status--${game.verdict}`}>{game.verdict}</span>
                <span className="table__meta">{game.playedAt}</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid grid--tertiary">
        <Leaderboard entries={leaderboard} />
        <Badges badges={badges} />
      </section>
    </main>
  );
};

export default Dashboard;
