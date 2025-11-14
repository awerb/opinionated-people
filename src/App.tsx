import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

type InviteMode = "locked" | "open";
type GamePhase = "setup" | "lobby" | "round" | "results" | "championship" | "finalResults";

type QuestionOption = { id: string; label: string };
type Question = {
  id: string;
  text: string;
  category: string;
  options: QuestionOption[];
};

type PlayerStatus = "active" | "voter";

type Player = {
  id: string;
  name: string;
  invitedBy: string | null;
  status: PlayerStatus;
  totalPoints: number;
  isCreator?: boolean;
  isFinalist?: boolean;
  avatarColor: string;
};

type GameRound = {
  id: string;
  questionId: string;
  isChampionship: boolean;
  status: "idle" | "active" | "complete";
};

type RoundSummary = {
  questionId: string;
  majorityOptions: string[];
  counts: Record<string, number>;
  responses: Record<string, string>;
  reason: "manual" | "timer" | "auto";
};

type InviteStatus = "pending" | "accepted";

type Invite = {
  id: string;
  contact: string;
  inviterId: string;
  status: InviteStatus;
  lastReminder?: number;
};

const questionBank: Question[] = [
  {
    id: "q1",
    text: "Pick the brunch spot everyone else is picturing",
    category: "Food & Drinks",
    options: [
      { id: "A", label: "Trendy avocado toast café" },
      { id: "B", label: "Bottomless mimosa bistro" },
      { id: "C", label: "Neighborhood diner" },
      { id: "D", label: "Farmers market food truck" },
    ],
  },
  {
    id: "q2",
    text: "Which city would most players daydream about visiting right now?",
    category: "Travel & Places",
    options: [
      { id: "A", label: "Lisbon" },
      { id: "B", label: "Tokyo" },
      { id: "C", label: "Mexico City" },
      { id: "D", label: "Reykjavík" },
    ],
  },
  {
    id: "q3",
    text: "Ultimate comfort show the group binges",
    category: "Entertainment",
    options: [
      { id: "A", label: "The Office" },
      { id: "B", label: "Great British Bake Off" },
      { id: "C", label: "Bluey" },
      { id: "D", label: "Friends" },
    ],
  },
  {
    id: "q4",
    text: "Morning beverage vibe check",
    category: "Daily Habits",
    options: [
      { id: "A", label: "Cold brew with oat milk" },
      { id: "B", label: "Matcha latte" },
      { id: "C", label: "Black coffee" },
      { id: "D", label: "Protein smoothie" },
    ],
  },
  {
    id: "q5",
    text: "Pick the pop culture moment everyone still quotes",
    category: "Pop Culture",
    options: [
      { id: "A", label: "Beyoncé's Coachella set" },
      { id: "B", label: "Barbieheimer summer" },
      { id: "C", label: "Succession finale" },
      { id: "D", label: "Pedro Pascal meme era" },
    ],
  },
  {
    id: "q6",
    text: "Preferred remote work backdrop",
    category: "Lifestyle",
    options: [
      { id: "A", label: "Minimalist studio" },
      { id: "B", label: "Lush plant jungle" },
      { id: "C", label: "Sunlit beach house" },
      { id: "D", label: "Hip coffee shop" },
    ],
  },
  {
    id: "q7",
    text: "Pick the sneaker everyone flexes",
    category: "Fashion & Style",
    options: [
      { id: "A", label: "Nike Dunks" },
      { id: "B", label: "Adidas Sambas" },
      { id: "C", label: "New Balance 550s" },
      { id: "D", label: "Veja V-10s" },
    ],
  },
  {
    id: "q8",
    text: "Which daily habit does this crew brag about?",
    category: "Habit Tracking",
    options: [
      { id: "A", label: "10k steps" },
      { id: "B", label: "Meditation streak" },
      { id: "C", label: "Wordle in 3" },
      { id: "D", label: "Cold plunges" },
    ],
  },
  {
    id: "q9",
    text: "Preferred group chat reaction style",
    category: "Social",
    options: [
      { id: "A", label: "All emojis all the time" },
      { id: "B", label: "Voice notes" },
      { id: "C", label: "Memes & gifs" },
      { id: "D", label: "Short text replies" },
    ],
  },
];

const colorPalette = ["#F97316", "#6366F1", "#10B981", "#EC4899", "#0EA5E9", "#F59E0B", "#F472B6", "#84CC16"];

const seededPlayers: Player[] = [
  {
    id: "player-creator",
    name: "Avery Creator",
    invitedBy: null,
    status: "active",
    totalPoints: 0,
    isCreator: true,
    avatarColor: colorPalette[0],
  },
  {
    id: "player-jordan",
    name: "Jordan H.",
    invitedBy: "player-creator",
    status: "active",
    totalPoints: 0,
    avatarColor: colorPalette[1],
  },
  {
    id: "player-sky",
    name: "Sky T.",
    invitedBy: "player-creator",
    status: "active",
    totalPoints: 0,
    avatarColor: colorPalette[2],
  },
  {
    id: "player-rae",
    name: "Rae M.",
    invitedBy: "player-jordan",
    status: "active",
    totalPoints: 0,
    avatarColor: colorPalette[3],
  },
];

const creatorId = seededPlayers[0].id;

const seededInvites: Invite[] = [
  { id: "invite-jordan", contact: "Jordan H.", inviterId: creatorId, status: "accepted" },
  { id: "invite-sky", contact: "Sky T.", inviterId: creatorId, status: "accepted" },
  { id: "invite-rae", contact: "Rae M.", inviterId: "player-jordan", status: "accepted" },
  { id: "invite-omar", contact: "Omar L.", inviterId: creatorId, status: "pending" },
  { id: "invite-kim", contact: "Kim P.", inviterId: creatorId, status: "pending" },
];

const getOptionLabel = (question: Question | undefined, id: string) =>
  question?.options.find((option) => option.id === id)?.label ?? id;

function App() {
  const [inviteMode, setInviteMode] = useState<InviteMode>("locked");
  const [phase, setPhase] = useState<GamePhase>("setup");
  const [players, setPlayers] = useState<Player[]>(seededPlayers);
  const [invites, setInvites] = useState<Invite[]>(seededInvites);
  const [roundCount, setRoundCount] = useState(3);
  const [finalistCount, setFinalistCount] = useState(3);
  const [timerSeconds, setTimerSeconds] = useState(45);
  const [prizeAmount, setPrizeAmount] = useState(250);
  const [rounds, setRounds] = useState<GameRound[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<RoundSummary | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(
    questionBank.slice(0, 5).map((question) => question.id),
  );
  const [inviteForm, setInviteForm] = useState({ name: "", inviterId: creatorId });

  const activeRound = rounds[currentRoundIndex];
  const currentQuestion = questionBank.find((question) => question.id === activeRound?.questionId);
  const generalRoundTotal = Math.max(0, rounds.filter((round) => !round.isChampionship).length);
  const finalists = players.filter((player) => player.isFinalist);
  const summaryQuestion = useMemo(() => questionBank.find((question) => question.id === summary?.questionId), [summary]);
  const invitesSent = invites.length;
  const acceptedInvites = invites.filter((invite) => invite.status === "accepted").length;
  const pendingInvites = invites.filter((invite) => invite.status === "pending");
  const inviteTreeDepth = useMemo(
    () => new Set(players.map((player) => player.invitedBy).filter(Boolean)).size + 1,
    [players],
  );
  const averageAccuracy = useMemo(
    () => (players.reduce((sum, player) => sum + player.totalPoints, 0) / Math.max(players.length, 1)).toFixed(1),
    [players],
  );
  const tickerMessages = useMemo(
    () => [
      `Live tonight · ${players.length} contenders`,
      `Jackpot locked at $${prizeAmount}`,
      `Round status: ${phase === "finalResults" ? "Winner declared" : phase}`,
      `Invite tree depth ${inviteTreeDepth} • Viral index ${(players.length / Math.max(seededPlayers.length, 1)).toFixed(1)}`,
      currentQuestion ? `On deck: ${currentQuestion.text}` : "Creator curating question lineup",
    ],
    [players.length, prizeAmount, phase, inviteTreeDepth, currentQuestion],
  );

  const respondablePlayers = useMemo(() => {
    if (!activeRound) return [];
    if (activeRound.isChampionship) {
      return players.filter((player) => player.isFinalist || player.status === "voter");
    }
    return players.filter((player) => player.status === "active");
  }, [players, activeRound]);

  const leaderboard = useMemo(
    () => [...players].sort((a, b) => b.totalPoints - a.totalPoints || a.name.localeCompare(b.name)),
    [players],
  );

  const invitationChains = useMemo(() => {
    const inviterMap = new Map(players.map((player) => [player.id, player]));
    return players.map((player) => ({
      player,
      inviter: player.invitedBy ? inviterMap.get(player.invitedBy) : undefined,
    }));
  }, [players]);

  const canStartGame = useMemo(() => {
    const activePlayers = players.filter((player) => player.status === "active").length;
    return activePlayers >= 4 && selectedQuestionIds.length >= roundCount + 1;
  }, [players, selectedQuestionIds, roundCount]);

  const resetTimer = useCallback(() => {
    setTimeLeft(timerSeconds);
    setDeadline(Date.now() + timerSeconds * 1000);
  }, [timerSeconds]);

  const prepareRoundStates = useCallback(
    (questionIds: string[]) => {
      const plannedRounds: GameRound[] = questionIds.map((questionId, index) => ({
        id: `round-${index + 1}`,
        questionId,
        isChampionship: index === questionIds.length - 1,
        status: index === 0 ? "active" : "idle",
      }));
      setRounds(plannedRounds);
      setCurrentRoundIndex(0);
      setResponses({});
      setSummary(null);
      resetTimer();
      setPhase("round");
    },
    [resetTimer],
  );

  const handleOpenLobby = () => {
    setPhase("lobby");
  };

  const handleStartGame = () => {
    if (!canStartGame) return;
    const uniqueSelection = selectedQuestionIds.filter((id, index, array) => array.indexOf(id) === index);
    const desiredLength = Math.min(roundCount, uniqueSelection.length - 1);
    const safeLength = Math.max(1, desiredLength);
    let questionIds = uniqueSelection.slice(0, safeLength + 1);

    if (questionIds.length < safeLength + 1) {
      const fallback = questionBank
        .map((question) => question.id)
        .filter((id) => !questionIds.includes(id))
        .slice(0, safeLength + 1 - questionIds.length);
      questionIds = questionIds.concat(fallback);
    }
    prepareRoundStates(questionIds);
  };

  const handleToggleQuestion = (id: string) => {
    setSelectedQuestionIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((questionId) => questionId !== id);
      }
      return [...prev, id];
    });
  };

  const handleAddPlayer = () => {
    if (!inviteForm.name.trim()) return;
    const selectedInviterId = inviteMode === "locked" ? creatorId : inviteForm.inviterId;
    const inviterExists = players.some((player) => player.id === selectedInviterId);

    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      name: inviteForm.name.trim(),
      invitedBy: inviterExists ? selectedInviterId : null,
      status: "active",
      totalPoints: 0,
      avatarColor: colorPalette[(players.length + 1) % colorPalette.length],
    };
    setPlayers((current) => [...current, newPlayer]);
    setInvites((current) => {
      const existingIndex = current.findIndex(
        (invite) => invite.contact.toLowerCase() === inviteForm.name.trim().toLowerCase(),
      );
      if (existingIndex >= 0) {
        const copy = [...current];
        copy[existingIndex] = { ...copy[existingIndex], status: "accepted" };
        return copy;
      }
      return [
        ...current,
        { id: `invite-${Date.now()}`, contact: inviteForm.name.trim(), inviterId: selectedInviterId, status: "accepted" },
      ];
    });
    setInviteForm({ name: "", inviterId: creatorId });
  };

  const handleSendReminder = (inviteId: string) => {
    setInvites((current) =>
      current.map((invite) => (invite.id === inviteId ? { ...invite, lastReminder: Date.now() } : invite)),
    );
  };

  const beginRound = useCallback(
    (roundIndex: number) => {
      setRounds((previous) =>
        previous.map((round, index) => {
          if (index < roundIndex) return { ...round, status: "complete" };
          if (index === roundIndex) return { ...round, status: "active" };
          return { ...round, status: "idle" };
        }),
      );
      setResponses({});
      setSummary(null);
      resetTimer();
    },
    [resetTimer],
  );

  const ensureResponses = useCallback(
    (currentResponses: Record<string, string>) => {
      const filled = { ...currentResponses };
      if (!currentQuestion) return filled;
      respondablePlayers.forEach((player) => {
        if (!filled[player.id]) {
          const randomOption = currentQuestion.options[Math.floor(Math.random() * currentQuestion.options.length)];
          filled[player.id] = randomOption.id;
        }
      });
      return filled;
    },
    [currentQuestion, respondablePlayers],
  );

  const finalizeRound = useCallback(
    (reason: "manual" | "timer" | "auto") => {
      if (!activeRound || !currentQuestion) return;
      const filledResponses = ensureResponses(responses);
      const counts: Record<string, number> = {};
      Object.values(filledResponses).forEach((optionId) => {
        counts[optionId] = (counts[optionId] ?? 0) + 1;
      });
      const tallyValues = Object.values(counts);
      const highestVote = tallyValues.length ? Math.max(...tallyValues) : 0;
      const majorityOptions =
        tallyValues.length > 0
          ? Object.entries(counts)
              .filter(([, count]) => count === highestVote)
              .map(([optionId]) => optionId)
          : currentQuestion.options.map((option) => option.id);

      setPlayers((current) =>
        current.map((player) => {
          const choice = filledResponses[player.id];
          const eligible = activeRound.isChampionship ? !!player.isFinalist : player.status === "active";
          if (!choice || !eligible) return player;
          const awarded = majorityOptions.includes(choice);
          return awarded ? { ...player, totalPoints: player.totalPoints + 1 } : player;
        }),
      );

      setRounds((prev) =>
        prev.map((round) => {
          if (round.id === activeRound.id) {
            return { ...round, status: "complete" };
          }
          return round;
        }),
      );
      setSummary({
        questionId: currentQuestion.id,
        majorityOptions,
        counts,
        responses: filledResponses,
        reason,
      });
      setDeadline(null);
      setTimeLeft(0);
      setPhase(activeRound.isChampionship ? "finalResults" : "results");
      setResponses(filledResponses);
    },
    [activeRound, currentQuestion, ensureResponses, responses],
  );

  const handleNextRound = () => {
    const nextIndex = currentRoundIndex + 1;
    if (nextIndex < generalRoundTotal) {
      setCurrentRoundIndex(nextIndex);
      beginRound(nextIndex);
      setPhase("round");
    } else if (rounds[nextIndex]) {
      const sorted = [...players].sort((a, b) => b.totalPoints - a.totalPoints);
      const cutoff = Math.min(finalistCount, sorted.length);
      const threshold =
        cutoff > 0 ? sorted[Math.min(cutoff - 1, sorted.length - 1)].totalPoints : sorted[sorted.length - 1]?.totalPoints;
      const finalistIds = sorted
        .filter((player, index) => index < cutoff || player.totalPoints === threshold)
        .map((player) => player.id);

      setPlayers((current) =>
        current.map((player) => {
          const isFinalist = finalistIds.includes(player.id);
          return {
            ...player,
            isFinalist,
            status: isFinalist ? "active" : "voter",
          };
        }),
      );

      setCurrentRoundIndex(nextIndex);
      beginRound(nextIndex);
      setPhase("championship");
    }
  };

  const handleSimulateResponses = () => {
    if (!currentQuestion) return;

    const generated: Record<string, string> = {};
    respondablePlayers.forEach((player) => {
      const option = currentQuestion.options[Math.floor(Math.random() * currentQuestion.options.length)];
      generated[player.id] = option.id;
    });
    setResponses(generated);
  };

  const handleRecordVote = (playerId: string, optionId: string) => {
    setResponses((current) => ({ ...current, [playerId]: optionId }));
  };

  const handleRestart = () => {
    setPhase("setup");
    setPlayers(seededPlayers.map((player) => ({ ...player, totalPoints: 0, status: "active", isFinalist: false })));
    setRounds([]);
    setResponses({});
    setSummary(null);
    setCurrentRoundIndex(0);
    setDeadline(null);
    setTimeLeft(timerSeconds);
  };

  useEffect(() => {
    if (!deadline || (phase !== "round" && phase !== "championship")) return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(interval);
        finalizeRound("timer");
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [deadline, finalizeRound, phase]);

  useEffect(() => {
    return () => {
      setDeadline(null);
    };
  }, []);

  return (
    <div className="app-stage">
      <div className="ambient-lights" aria-hidden="true">
        <div className="beam beam-left" />
        <div className="beam beam-right" />
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="grid-overlay" />
      </div>
      <div className="ticker" role="status" aria-live="polite">
        <div className="ticker-track">
          {tickerMessages.map((message, index) => (
            <span key={`${message}-${index}`}>{message}</span>
          ))}
        </div>
      </div>
      <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Creator Dashboard</p>
          <h1>Opinionated People</h1>
          <p className="lede">
            Multiplayer prediction game where success = reading the room. Configure rounds, send invites, and run the
            live show from one control center.
          </p>
        </div>
        <div className="hero-stats">
          <div className="stat-tile">
            <p className="stat-label">Active players</p>
            <p className="stat-value">{players.length}</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Round timer</p>
            <p className="stat-value">{timerSeconds}s</p>
          </div>
          <div className="stat-tile">
            <p className="stat-label">Avg accuracy</p>
            <p className="stat-value">{averageAccuracy} pts</p>
          </div>
        </div>
        <div className="prize-board">
          <p className="eyebrow">Jackpot</p>
          <strong>${prizeAmount}</strong>
          <p>Skill-game payout ready</p>
          <div className="spotlights" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>
      </header>

      <section className="grid">
        <div className="panel admin-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Creator Tools</p>
              <h2>Showrunner console</h2>
              <p className="tip">Cue rounds, watch invites, and tap reminders to keep energy up.</p>
            </div>
            <span className="phase-pill">Admin</span>
          </div>
          <div className="admin-metrics">
            <div>
              <p className="stat-label">Invites sent</p>
              <strong>{invitesSent}</strong>
            </div>
            <div>
              <p className="stat-label">Accepted</p>
              <strong>{acceptedInvites}</strong>
            </div>
            <div>
              <p className="stat-label">Pending</p>
              <strong>{pendingInvites.length}</strong>
            </div>
          </div>
          <div className="admin-actions">
            <button className="ghost" onClick={() => window.alert("Quick nudge sent to all players")}>Broadcast poke</button>
            <button onClick={() => window.alert("Timer reminder pushed to players")}>Remind about timer</button>
          </div>
          <div className="pending-list">
            <p className="eyebrow">Pending invites</p>
            {pendingInvites.length === 0 ? (
              <p className="muted">All guests seated. Add more from the roster panel.</p>
            ) : (
              <ul>
                {pendingInvites.map((invite) => (
                  <li key={invite.id}>
                    <div>
                      <strong>{invite.contact}</strong>
                      <small>Via {players.find((player) => player.id === invite.inviterId)?.name ?? "creator"}</small>
                    </div>
                    <button className="ghost" onClick={() => handleSendReminder(invite.id)}>
                      {invite.lastReminder ? "Reminded" : "Poke"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="panel wide">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Game Setup</p>
              <h2>Configure tonight&apos;s game</h2>
              <p className="tip">Pick the vibe, rounds, and prize. Players see updates instantly.</p>
            </div>
            <div className="phase-pill">{phase}</div>
          </div>

          <div className="config-grid">
            <label className="field">
              <span>Invite mode</span>
              <select value={inviteMode} onChange={(event) => setInviteMode(event.target.value as InviteMode)}>
                <option value="locked">Locked — creator only</option>
                <option value="open">Open — players can invite</option>
              </select>
            </label>

            <label className="field">
              <span>General rounds</span>
              <input
                type="number"
                min={1}
                max={5}
                value={roundCount}
                onChange={(event) => setRoundCount(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Finalist count</span>
              <input
                type="number"
                min={2}
                max={6}
                value={finalistCount}
                onChange={(event) => setFinalistCount(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Timer (seconds)</span>
              <input
                type="number"
                min={20}
                max={90}
                value={timerSeconds}
                onChange={(event) => setTimerSeconds(Number(event.target.value))}
              />
            </label>

            <label className="field">
              <span>Prize pool</span>
              <input
                type="number"
                min={0}
                value={prizeAmount}
                onChange={(event) => setPrizeAmount(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="config-actions">
            <button className="ghost" onClick={handleOpenLobby}>
              Open Lobby
            </button>
            <button disabled={!canStartGame} onClick={handleStartGame}>
              Start Game
            </button>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Question Bank</p>
              <h2>Select prompts</h2>
              <p className="tip">Simple, relatable prompts land best. Tie questions to your crowd.</p>
            </div>
            <span>{selectedQuestionIds.length} chosen</span>
          </div>

          <div className="question-list">
            {questionBank.map((question) => (
              <label key={question.id} className="question-item">
                <input
                  type="checkbox"
                  checked={selectedQuestionIds.includes(question.id)}
                  onChange={() => handleToggleQuestion(question.id)}
                />
                <div>
                  <p className="question-category">{question.category}</p>
                  <p className="question-text">{question.text}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Invitations</p>
              <h2>Player roster</h2>
              <p className="tip">Add names, then let open mode fuel viral growth.</p>
            </div>
            <span>{inviteMode === "locked" ? "Creator only invites" : "Players can chain invite"}</span>
          </div>

          <ul className="player-list">
            {invitationChains.map(({ player, inviter }) => (
              <li key={player.id}>
                <span className="player-avatar" style={{ backgroundColor: player.avatarColor }}>
                  {player.name
                    .split(" ")
                    .map((letter) => letter[0])
                    .join("")
                    .slice(0, 2)}
                </span>
                <div>
                  <p className="player-name">
                    {player.name} {player.isCreator && <span className="tag">Creator</span>}
                    {player.isFinalist && <span className="tag highlight">Finalist</span>}
                  </p>
                  <p className="player-meta">
                    Invited by {inviter ? inviter.name : "creator"} · {player.totalPoints} pts
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="invite-form">
            <input
              placeholder="Add player name"
              value={inviteForm.name}
              onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
            />
            <select
              value={inviteForm.inviterId}
              disabled={inviteMode === "locked"}
              onChange={(event) => setInviteForm((current) => ({ ...current, inviterId: event.target.value }))}
            >
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
            <button onClick={handleAddPlayer}>Add Player</button>
          </div>
        </div>

        <div className="panel wide emphasis">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live Round</p>
              <h2>{currentQuestion ? currentQuestion.text : "Waiting to start"} </h2>
              <p className="tip">Tell players: “Pick what the room will say, not your fave.”</p>
            </div>
            <div className="timer">
              <span>⏱</span>
              <strong>{timeLeft}s</strong>
            </div>
          </div>
          {currentQuestion && (
            <>
              <div className="option-grid">
                {currentQuestion.options.map((option) => {
                  const votes = summary?.counts[option.id] ?? 0;
                  const isMajority = summary?.majorityOptions.includes(option.id);
                  return (
                    <button
                      key={option.id}
                      className={`option-card ${
                        isMajority ? "majority" : responses && Object.values(responses).includes(option.id) ? "voted" : ""
                      }`}
                    >
                      <span>{option.label}</span>
                      {isMajority && <small>Majority pick</small>}
                      {summary && <small>{votes} votes</small>}
                    </button>
                  );
                })}
              </div>

              <div className="round-actions">
                <button className="ghost" onClick={handleSimulateResponses}>
                  Auto-fill responses
                </button>
                <button onClick={() => finalizeRound("manual")}>Resolve round</button>
              </div>

              <div className="responses">
                {respondablePlayers.map((player) => (
                  <div key={player.id} className="response-row">
                    <strong>{player.name}</strong>
                    <div className="response-options">
                      {currentQuestion.options.map((option) => {
                        const selected = responses[player.id] === option.id;
                        return (
                          <button
                            key={option.id}
                            className={selected ? "selected" : ""}
                            onClick={() => handleRecordVote(player.id, option.id)}
                          >
                            {option.id}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!currentQuestion && (
            <p className="muted">Select prompts and start the game to load the first question.</p>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Leaderboard</p>
              <h2>Live standings</h2>
              <p className="tip">Share this between rounds to hype the majority guessers.</p>
            </div>
            <span>{phase === "finalResults" ? "Game complete" : "Updating in real time"}</span>
          </div>
          <table className="leaderboard">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Points</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((player, index) => (
                <tr key={player.id}>
                  <td>{index + 1}</td>
                  <td>{player.name}</td>
                  <td>{player.totalPoints}</td>
                  <td>{player.isFinalist ? "Finalist" : player.status === "voter" ? "Voter" : "Active"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {phase === "finalResults" && (
            <div className="winner-card">
              <p className="eyebrow">Winner</p>
              <h3>{leaderboard[0]?.name ?? "TBD"}</h3>
              <p className="lede">Payout ready — ${prizeAmount}</p>
              <button onClick={handleRestart}>Restart Game</button>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Round Control</p>
              <h2>Progression</h2>
              <p className="tip">Resolve quickly; suspense comes from recaps, not downtime.</p>
            </div>
          </div>
          <ul className="round-tracker">
            {rounds.map((round, index) => (
              <li key={round.id} className={`round-chip ${round.status}`}>
                Round {index + 1} • {round.isChampionship ? "Championship" : "General"}
              </li>
            ))}
          </ul>
          {summary && (
            <div className="summary">
              <p className="eyebrow">Majority answer</p>
              {summary.majorityOptions.map((option) => (
                <p key={option}>{getOptionLabel(summaryQuestion, option)}</p>
              ))}
              <small>Resolved via {summary.reason}</small>
            </div>
          )}
          {phase === "results" && (
            <button onClick={handleNextRound}>
              {currentRoundIndex + 1 < generalRoundTotal ? "Next Round" : "Start Championship"}
            </button>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Championship</p>
              <h2>Final stage</h2>
              <p className="tip">Announce finalists out loud—give voters a role to keep them glued.</p>
            </div>
            <span>{finalists.length} finalists</span>
          </div>
          {finalists.length === 0 ? (
            <p className="muted">Finish general rounds to lock in finalists.</p>
          ) : (
            <ul className="championship-list">
              {finalists.map((player) => (
                <li key={player.id}>
                  <strong>{player.name}</strong>
                  <span>{player.totalPoints} pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Insights</p>
              <h2>Engagement feed</h2>
              <p className="tip">Use these quick stats to brag about community momentum.</p>
            </div>
          </div>
          <ul className="activity-list">
            <li>Invite tree depth: {inviteTreeDepth}</li>
            <li>Average accuracy: {averageAccuracy} pts</li>
            <li>Notifications sent: lobby ready, timer warnings, round recap</li>
            <li>Share link copied 12 times · Viral coefficient 1.4</li>
          </ul>
        </div>
      </section>
      </div>
    </div>
  );
}

export default App;
