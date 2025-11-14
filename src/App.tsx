import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { createLatencyEntry, createWebSocketEntry } from "./utils/telemetry";
import type { TelemetryEntry } from "./utils/telemetry";

const MIN_PLAYERS = 3;
const TIMER_SECONDS = 5;
const CHAMPIONSHIP_STAGES = ["Qualifiers", "Semifinals", "Final Showdown", "Champion Crowned"];

type Player = {
  id: number;
  name: string;
  score: number;
};

type Invite = {
  id: number;
  email: string;
  status: "pending" | "accepted";
};

function App() {
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState(TIMER_SECONDS);
  const [timerActive, setTimerActive] = useState(false);
  const [roundStartTime, setRoundStartTime] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState("Waiting for players to join.");
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [championshipStage, setChampionshipStage] = useState(0);
  const [telemetryEntries, setTelemetryEntries] = useState<TelemetryEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!timerActive) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          clearInterval(timerRef.current ?? undefined);
          timerRef.current = null;
          setTimerActive(false);
          setStatusMessage("Timer expired, locking in opinions.");
          setTelemetryEntries((entries) => {
            const entry = createWebSocketEntry("timer-expired");
            return [entry, ...entries].slice(0, 25);
          });
          return TIMER_SECONDS;
        }

        return current - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timerActive]);

  const leaders = useMemo(() => {
    if (!players.length) {
      return [];
    }

    const topScore = Math.max(...players.map((player) => player.score));
    return players.filter((player) => player.score === topScore && topScore > 0);
  }, [players]);

  const handleAddPlayer = () => {
    const trimmed = playerName.trim();
    if (!trimmed) return;
    if (players.some((player) => player.name.toLowerCase() === trimmed.toLowerCase())) {
      setStatusMessage(`${trimmed} is already seated.`);
      return;
    }

    const updatedPlayers = [...players, { id: Date.now(), name: trimmed, score: 0 }];
    setPlayers(updatedPlayers);
    setPlayerName("");
    setStatusMessage(`${trimmed} locked in. Minimum players: ${MIN_PLAYERS}.`);
    setTelemetryEntries((entries) => {
      const entry = createWebSocketEntry("player-joined", trimmed);
      return [entry, ...entries].slice(0, 25);
    });
  };

  const handleStartRound = () => {
    if (players.length < MIN_PLAYERS) {
      setStatusMessage(`Need ${MIN_PLAYERS - players.length} more players to start.`);
      return;
    }

    setSecondsRemaining(TIMER_SECONDS);
    setTimerActive(true);
    setRoundStartTime(Date.now());
    setStatusMessage("Round live. Capture votes now!");
    setTelemetryEntries((entries) => {
      const entry = createWebSocketEntry("round-started");
      return [entry, ...entries].slice(0, 25);
    });
  };

  const handleAddScore = (playerId: number) => {
    const startTime = roundStartTime ?? Date.now();
    setRoundStartTime(startTime);

    let scoringPlayerName = "";
    setPlayers((currentPlayers) =>
      currentPlayers.map((player) => {
        if (player.id === playerId) {
          scoringPlayerName = player.name;
          return { ...player, score: player.score + 1 };
        }
        return player;
      }),
    );

    if (scoringPlayerName) {
      const latency = Date.now() - startTime;
      setTelemetryEntries((entries) => {
        const entry = createLatencyEntry(scoringPlayerName, latency);
        return [entry, ...entries].slice(0, 25);
      });
    }
  };

  const handleSendInvite = () => {
    const trimmed = inviteEmail.trim();
    if (!trimmed) return;

    const invite: Invite = {
      id: Date.now(),
      email: trimmed,
      status: "pending",
    };

    setInvites((existing) => [invite, ...existing]);
    setInviteEmail("");
    setStatusMessage(`Invite sent to ${trimmed}.`);
    setTelemetryEntries((entries) => {
      const entry = createWebSocketEntry("invite-sent", trimmed);
      return [entry, ...entries].slice(0, 25);
    });
  };

  const handleAcceptInvite = (inviteId: number) => {
    setInvites((existing) => existing.map((invite) => (invite.id === inviteId ? { ...invite, status: "accepted" } : invite)));
    setTelemetryEntries((entries) => {
      const entry = createWebSocketEntry("invite-accepted");
      return [entry, ...entries].slice(0, 25);
    });
  };

  const handleAdvanceStage = () => {
    if (players.length < MIN_PLAYERS) {
      setStatusMessage("Need a full lobby before advancing stages.");
      return;
    }

    setChampionshipStage((stage) => {
      const nextStage = Math.min(stage + 1, CHAMPIONSHIP_STAGES.length - 1);
      setStatusMessage(`Advanced to ${CHAMPIONSHIP_STAGES[nextStage]}.`);
      return nextStage;
    });
  };

  const currentStageLabel = CHAMPIONSHIP_STAGES[championshipStage];
  const tieDetected = leaders.length > 1;

  return (
    <main className="app-shell">
      <header>
        <h1>Opinionated People</h1>
        <p>Real-time debate scoring sandbox</p>
      </header>

      <section className="panel">
        <h2>Lobby</h2>
        <div className="field-row">
          <input
            aria-label="Player name"
            value={playerName}
            onChange={(event) => setPlayerName(event.target.value)}
            placeholder="Add player"
          />
          <button onClick={handleAddPlayer} data-testid="add-player">
            Add
          </button>
        </div>
        <p className="helper-text">Minimum players required: {MIN_PLAYERS}</p>
        <button
          className="primary"
          onClick={handleStartRound}
          disabled={players.length < MIN_PLAYERS || timerActive}
          data-testid="start-round"
        >
          Start Round
        </button>
        <p className="status" data-testid="lobby-status">
          {statusMessage}
        </p>
        <ul className="player-list">
          {players.map((player) => (
            <li key={player.id}>
              <span>{player.name}</span>
              <button onClick={() => handleAddScore(player.id)} data-testid={`score-${player.name}`}>
                + Opinion Win
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-live="polite">
        <h2>Round Timer</h2>
        <div className="timer" data-testid="timer-display">
          {timerActive ? `${secondsRemaining}s remaining` : "Timer idle"}
        </div>
        <p>{timerActive ? "Players are debating..." : "Start a round to trigger the clock."}</p>
      </section>

      <section className="panel">
        <h2>Scoreboard</h2>
        <table className="scoreboard">
          <thead>
            <tr>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id} className={leaders.some((leader) => leader.id === player.id) ? "leader" : undefined}>
                <td>{player.name}</td>
                <td>{player.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {players.length > 0 && (
          <p className="status" data-testid="score-status">
            {leaders.length === 0 && "Waiting for first score."}
            {leaders.length === 1 && `Current leader: ${leaders[0].name}`}
            {tieDetected && `It's a tie between ${leaders.map((leader) => leader.name).join(" and ")}`}
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Invites</h2>
        <div className="field-row">
          <input
            aria-label="Invite email"
            value={inviteEmail}
            onChange={(event) => setInviteEmail(event.target.value)}
            placeholder="teammate@example.com"
          />
          <button onClick={handleSendInvite} data-testid="send-invite">
            Send
          </button>
        </div>
        <ul className="invite-list">
          {invites.map((invite) => (
            <li key={invite.id}>
              <span>
                {invite.email} – {invite.status}
              </span>
              {invite.status === "pending" && (
                <button onClick={() => handleAcceptInvite(invite.id)} data-testid={`accept-${invite.email}`}>
                  Mark accepted
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Championship Flow</h2>
        <p data-testid="championship-stage">Stage: {currentStageLabel}</p>
        <button className="primary" onClick={handleAdvanceStage} data-testid="advance-stage">
          Advance Stage
        </button>
        <p className="helper-text">
          Progress through qualifiers → semifinals → final showdown. The last stage locks in the champion.
        </p>
        {currentStageLabel === "Champion Crowned" && leaders.length === 1 && (
          <p className="status" data-testid="champion-callout">
            {leaders[0].name} is the champion!
          </p>
        )}
        {tieDetected && (
          <p className="status" data-testid="tie-message">
            Tie detected. Sudden death required.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Live Telemetry</h2>
        <p>Monitoring WebSocket signals and scoring latency.</p>
        <ul className="telemetry" data-testid="telemetry-feed">
          {telemetryEntries.map((entry) => (
            <li key={entry.id}>
              <span>{entry.timestamp}</span>
              <span>{entry.message}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

export default App;
