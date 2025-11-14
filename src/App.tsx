import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { GameInvitation, GameParticipant, GameRound, GameState, InviteMode, Question } from "./api";
import {
  API_BASE,
  advanceGame,
  createGame,
  createInvite,
  fetchGame,
  fetchQuestions,
  finalizeRound,
  joinGame,
  remindInvite,
  startGame,
  submitResponse,
} from "./api";

const SESSION_KEY = "opinionated-people/session";
const WS_BASE = (import.meta.env.VITE_WS_URL as string | undefined) ?? API_BASE.replace(/^http/, "ws");

type Session = {
  gameId: string;
  participantId: string;
  code: string;
};

type HostFormState = {
  creatorName: string;
  inviteMode: InviteMode;
  timerSeconds: number;
  generalRoundCount: number;
  finalistCount: number;
  prizeAmount: number;
  questionIds: string[];
};

type JoinFormState = {
  username: string;
  code: string;
  inviteId: string;
};

const defaultJoinForm: JoinFormState = {
  username: "Guest",
  code: "",
  inviteId: "",
};

const fallbackQuestions: Question[] = [
  {
    id: "bandwagon-q1",
    text: "Pick the brunch spot everyone else is picturing.",
    category: "Food & Drinks",
    optionA: "Trendy avocado toast café",
    optionB: "Bottomless mimosa bistro",
    optionC: "Neighborhood diner",
    optionD: "Farmers market food truck",
  },
  {
    id: "bandwagon-q2",
    text: "Which city would most players daydream about visiting right now?",
    category: "Travel",
    optionA: "Lisbon",
    optionB: "Tokyo",
    optionC: "Mexico City",
    optionD: "Reykjavík",
  },
  {
    id: "bandwagon-q3",
    text: "Ultimate comfort show the group binges.",
    category: "Entertainment",
    optionA: "The Office",
    optionB: "Great British Bake Off",
    optionC: "Bluey",
    optionD: "Friends",
  },
  {
    id: "bandwagon-q4",
    text: "Morning beverage vibe check.",
    category: "Daily Habits",
    optionA: "Cold brew with oat milk",
    optionB: "Matcha latte",
    optionC: "Black coffee",
    optionD: "Protein smoothie",
  },
  {
    id: "bandwagon-q5",
    text: "Pick the pop culture moment everyone still quotes.",
    category: "Pop Culture",
    optionA: "Beyoncé's Coachella set",
    optionB: "Barbieheimer summer",
    optionC: "Succession finale",
    optionD: "Pedro Pascal meme era",
  },
  {
    id: "bandwagon-q6",
    text: "Preferred remote work backdrop.",
    category: "Lifestyle",
    optionA: "Minimalist studio",
    optionB: "Lush plant jungle",
    optionC: "Sunlit beach house",
    optionD: "Hip coffee shop",
  },
  {
    id: "bandwagon-q7",
    text: "Which daily habit does this crew brag about?",
    category: "Habit Tracking",
    optionA: "10k steps",
    optionB: "Meditation streak",
    optionC: "Wordle in 3",
    optionD: "Cold plunges",
  },
  {
    id: "bandwagon-q8",
    text: "Preferred group chat reaction style.",
    category: "Social",
    optionA: "All emojis all the time",
    optionB: "Voice notes",
    optionC: "Memes & gifs",
    optionD: "Short replies",
  },
  {
    id: "bandwagon-q9",
    text: "Pick the sneaker everyone flexes.",
    category: "Fashion",
    optionA: "Nike Dunks",
    optionB: "Adidas Sambas",
    optionC: "New Balance 550s",
    optionD: "Veja V-10s",
  },
];

const sampleLeaderboard = [
  { name: "Liam (You)", points: 1780, highlight: true },
  { name: "Chloe W.", points: 1310 },
  { name: "Noah S.", points: 1090 },
];

const defaultHostForm: HostFormState = {
  creatorName: "Bandwagon Host",
  inviteMode: "OPEN",
  timerSeconds: 45,
  generalRoundCount: 3,
  finalistCount: 3,
  prizeAmount: 250,
  questionIds: fallbackQuestions.slice(0, 4).map((question) => question.id),
};

const readSession = (): Session | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
};

const writeSession = (value: Session | null) => {
  if (!value) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(value));
};

const useCountdown = (targetDate: string | null) => {
  const [timeLeft, setTimeLeft] = useState(0);
  useEffect(() => {
    if (!targetDate) {
      setTimeLeft(0);
      return;
    }
    const update = () => {
      const remaining = Math.max(0, Math.ceil((new Date(targetDate).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [targetDate]);
  return timeLeft;
};

function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [game, setGame] = useState<GameState | null>(null);
  const [questions, setQuestions] = useState<Question[]>(fallbackQuestions);
  const [hostForm, setHostForm] = useState<HostFormState>(defaultHostForm);
  const [joinForm, setJoinForm] = useState<JoinFormState>(defaultJoinForm);
  const [inviteContact, setInviteContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const currentRound: GameRound | null = useMemo(() => {
    if (!game) return null;
    return (
      game.rounds.find((round) => round.id === game.currentRoundId) ??
      game.rounds.find((round) => round.status === "ACTIVE") ??
      null
    );
  }, [game]);

  const previousRound = useMemo(() => {
    if (!game) return null;
    return (
      [...game.rounds]
        .filter((round) => round.status === "COMPLETE")
        .sort((a, b) => b.index - a.index)[0] ?? null
    );
  }, [game]);

  const me: GameParticipant | undefined = useMemo(() => {
    if (!session || !game) return undefined;
    return game.participants.find((participant) => participant.id === session.participantId);
  }, [game, session]);

  const timeLeft = useCountdown(currentRound?.endsAt ?? null);

  const leaderboard = useMemo(() => {
    if (!game) return [];
    return [...game.participants].sort((a, b) => b.totalPoints - a.totalPoints || a.user.username.localeCompare(b.user.username));
  }, [game]);

  const inviteStats = useMemo(() => {
    const sent = game?.invitations.length ?? 0;
    const accepted = game?.invitations.filter((invite) => invite.status === "ACCEPTED").length ?? 0;
    const pending = sent - accepted;
    return { sent, accepted, pending };
  }, [game]);

  const pendingInvites = useMemo(() => game?.invitations.filter((invite) => invite.status === "PENDING") ?? [], [game]);

  const finalsReady = game?.status === "CHAMPIONSHIP" || leaderboard.some((player) => player.isFinalist);

  const playerResponseKey = currentRound && session ? `${currentRound.id}:${session.participantId}` : null;
  const playerResponse = playerResponseKey && game ? game.responses[playerResponseKey] : null;

  const roundResponses = useMemo(() => {
    if (!currentRound || !game) return [];
    return Object.values(game.responses).filter((response) => response.roundId === currentRound.id);
  }, [currentRound, game]);

  const counts = useMemo(() => {
    if (!currentRound) return {} as Record<string, number>;
    return roundResponses.reduce<Record<string, number>>((acc, response) => {
      acc[response.selectedOption] = (acc[response.selectedOption] ?? 0) + 1;
      return acc;
    }, {});
  }, [currentRound, roundResponses]);

const questionOptions = (question?: Question) =>
    question
      ? [
          { id: "A", label: question.optionA },
          { id: "B", label: question.optionB },
          { id: "C", label: question.optionC },
          { id: "D", label: question.optionD },
        ]
      : [];

  const showAdmin = !!me?.isCreator;
  const completedRounds = useMemo(() => game?.rounds.filter((round) => round.status === "COMPLETE").length ?? 0, [game]);
  const stageCards = useMemo(() => {
    if (!game) return [];
    const totalRounds = game.rounds.length;
    return [
      {
        key: "prelaunch",
        title: "Pre-Launch",
        value: game.status === "LOBBY" ? "Configuring" : "Complete",
        detail: game.status === "LOBBY" ? "Tweak settings & invites" : "Lobby ready",
        status: game.status === "LOBBY" ? "active" : "complete",
      },
      {
        key: "invites",
        title: "Invites",
        value: `${inviteStats.sent} sent`,
        detail: `${inviteStats.accepted} joined`,
        status: inviteStats.accepted >= 4 ? "complete" : inviteStats.sent > 0 ? "active" : "pending",
      },
      {
        key: "rounds",
        title: currentRound ? `Round ${currentRound.index + 1}/${totalRounds}` : `Rounds ${completedRounds}/${totalRounds}`,
        value: currentRound ? `${timeLeft}s left` : `${completedRounds} finished`,
        detail:
          currentRound && currentRound.status === "ACTIVE"
            ? "Keep the pace tight"
            : completedRounds === totalRounds
              ? "All questions scored"
              : "Advance when ready",
        status:
          game.status === "COMPLETE" ? "complete" : currentRound ? "active" : completedRounds > 0 ? "active" : "pending",
      },
      {
        key: "finale",
        title: "Finale",
        value: game.status === "COMPLETE" ? "Winner locked" : finalsReady ? "Finalists ready" : "Coming soon",
        detail: finalsReady ? "Voters stay engaged" : "Need more rounds",
        status: game.status === "COMPLETE" ? "complete" : finalsReady ? "active" : "pending",
      },
    ];
  }, [game, inviteStats, currentRound, completedRounds, finalsReady, timeLeft]);

  const syncGame = async (identifier: string) => {
    const next = await fetchGame(identifier);
    setGame(next);
  };

  const handleCreateGame = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setLoading(true);
      setNotice(null);
      const minimalSelection = hostForm.generalRoundCount + 1;
      if (hostForm.questionIds.length < minimalSelection) {
        throw new Error(`Select at least ${minimalSelection} questions to cover the rounds plus finals.`);
      }
      const payload = await createGame(hostForm);
      const nextSession: Session = {
        gameId: payload.gameId,
        participantId: payload.participantId,
        code: payload.code,
      };
      setSession(nextSession);
      writeSession(nextSession);
      await syncGame(payload.gameId);
      setNotice("Game created — share the code to invite players.");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setLoading(true);
      setNotice(null);
      const existing = await fetchGame(joinForm.code.trim().toUpperCase());
      const joinResult = await joinGame(existing.id, {
        username: joinForm.username,
        inviteId: joinForm.inviteId || undefined,
      });
      const nextSession: Session = {
        gameId: existing.id,
        participantId: joinResult.participantId,
        code: existing.code,
      };
      setSession(nextSession);
      writeSession(nextSession);
      await syncGame(existing.id);
      setNotice("You're in! Keep this tab open during the show.");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = () => {
    setSession(null);
    setGame(null);
    writeSession(null);
    setJoinForm(defaultJoinForm);
    setHostForm(defaultHostForm);
  };

  const handleStartGame = async () => {
    if (!session) return;
    try {
      const next = await startGame(session.gameId);
      setGame(next);
      setNotice("Round 1 is live — start the countdown in your voice chat.");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleSubmitResponse = async (optionId: string) => {
    if (!session || !currentRound) return;
    try {
      const next = await submitResponse(session.gameId, currentRound.id, {
        participantId: session.participantId,
        selectedOption: optionId,
      });
      setGame(next);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleFinalizeRound = async () => {
    if (!session || !currentRound) return;
    try {
      const next = await finalizeRound(session.gameId, currentRound.id);
      setGame(next);
      setNotice("Round locked. Share the results and hype the leaderboard!");
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleAdvance = async () => {
    if (!session) return;
    try {
      const next = await advanceGame(session.gameId);
      setGame(next);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleCreateInvite = async (contact: string) => {
    if (!session || !contact.trim()) return;
    try {
      await createInvite(session.gameId, {
        inviteeContact: contact,
        inviterParticipantId: session.participantId,
      });
      await syncGame(session.gameId);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  const handleReminder = async (invite: GameInvitation) => {
    if (!session) return;
    try {
      await remindInvite(invite.id);
      await syncGame(session.gameId);
      setNotice(`Reminder sent to ${invite.inviteeContact}`);
    } catch (error) {
      setNotice((error as Error).message);
    }
  };

  useEffect(() => {
    fetchQuestions()
      .then((list) => {
        const usable = list.length > 0 ? list : fallbackQuestions;
        setQuestions(usable);
        setHostForm((prev) => {
          const existing = prev.questionIds.length > 0 ? prev.questionIds : usable.slice(0, prev.generalRoundCount + 1).map((question) => question.id);
          return { ...prev, questionIds: existing };
        });
        if (list.length === 0) {
          setNotice("Using Bandwagon starter questions while the database syncs.");
        }
      })
      .catch(() => {
        setQuestions(fallbackQuestions);
        setHostForm((prev) => ({ ...prev, questionIds: fallbackQuestions.slice(0, prev.generalRoundCount + 1).map((question) => question.id) }));
        setNotice("Couldn’t reach the question bank, showing sample prompts instead.");
      });
  }, []);

  useEffect(() => {
    if (!session) return;
    syncGame(session.gameId).catch((error) => setNotice((error as Error).message));
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
    const url = `${WS_BASE.replace(/\/$/, "")}/ws?gameId=${session.gameId}`;
    const socket = new WebSocket(url);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data as string);
      if (payload.type === "GAME_UPDATE") {
        setGame(payload.data as GameState);
      }
    };
    socket.onerror = () => {
      socket.close();
    };
    return () => socket.close();
  }, [session?.gameId]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const renderLanding = () => (
    <>
      <section className="landing-hero">
        <div className="hero-left">
          <BandwagonWordmark />
          <div className="avatar-orb" role="img" aria-label="Bandwagon avatar">
            🎭
          </div>
          <p className="player-name">You</p>
          <p className="player-level">Player level 3</p>
          <div className="xp-bar">
            <div className="xp-fill" style={{ width: "65%" }} />
          </div>
          <small className="xp-label">XP to level 4</small>
          <div className="hero-actions">
            <button type="button" onClick={() => scrollTo("host-setup")}>
              Start new game
            </button>
            <button type="button" className="secondary" onClick={() => scrollTo("join-panel")}>
              Join with code
            </button>
            <button type="button" className="ghost" onClick={() => setNotice("Quick match is coming soon!")}>
              Quick match
            </button>
          </div>
        </div>
        <div className="hero-right">
          <div className="leader-snippet">
            <div className="leader-headline">
              <p>Leaderboard</p>
              <span className="pill hot">Live</span>
            </div>
            <ul>
              {sampleLeaderboard.map((entry, index) => (
                <li key={entry.name} className={entry.highlight ? "active" : ""}>
                  <span className="rank">{index + 1}</span>
                  <div>
                    <p className="name">{entry.name}</p>
                    <small>{entry.points} pts</small>
                  </div>
                  {entry.highlight && <span className="mint-pill">You</span>}
                </li>
              ))}
            </ul>
            <p className="view-link" onClick={() => setNotice("Global leaderboard coming soon!")}>
              View global leaderboard
            </p>
          </div>
        </div>
      </section>
      <section className="grid" id="host-setup">
        <form className="panel wide" onSubmit={handleCreateGame}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Host A Game</p>
            <h2>Create a show</h2>
            <p className="tip">Pick questions, set the pace, and share the lobby code.</p>
          </div>
        </div>
        <div className="config-grid">
          <label className="field">
            <span>Creator name</span>
            <input
              value={hostForm.creatorName}
              onChange={(event) => setHostForm((prev) => ({ ...prev, creatorName: event.target.value }))}
            />
          </label>
          <label className="field">
            <span>Invite mode</span>
            <select
              value={hostForm.inviteMode}
              onChange={(event) => setHostForm((prev) => ({ ...prev, inviteMode: event.target.value as InviteMode }))}
            >
              <option value="LOCKED">Locked — only creator can invite</option>
              <option value="OPEN">Open — viral invites on</option>
            </select>
          </label>
          <label className="field">
            <span>Timer (seconds)</span>
            <input
              type="number"
              min={20}
              max={90}
              value={hostForm.timerSeconds}
              onChange={(event) => setHostForm((prev) => ({ ...prev, timerSeconds: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>General rounds</span>
            <input
              type="number"
              min={1}
              max={5}
              value={hostForm.generalRoundCount}
              onChange={(event) => setHostForm((prev) => ({ ...prev, generalRoundCount: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>Finalist slots</span>
            <input
              type="number"
              min={2}
              max={6}
              value={hostForm.finalistCount}
              onChange={(event) => setHostForm((prev) => ({ ...prev, finalistCount: Number(event.target.value) }))}
            />
          </label>
          <label className="field">
            <span>Prize pool</span>
            <input
              type="number"
              min={0}
              value={hostForm.prizeAmount}
              onChange={(event) => setHostForm((prev) => ({ ...prev, prizeAmount: Number(event.target.value) }))}
            />
          </label>
        </div>
        <div className="question-list">
          {questions.map((question) => (
            <label key={question.id} className="question-item">
              <input
                type="checkbox"
                checked={hostForm.questionIds.includes(question.id)}
                onChange={() => {
                  setHostForm((prev) => {
                    const exists = prev.questionIds.includes(question.id);
                    if (exists) {
                      return { ...prev, questionIds: prev.questionIds.filter((id) => id !== question.id) };
                    }
                    return { ...prev, questionIds: [...prev.questionIds, question.id] };
                  });
                }}
              />
              <div>
                <p className="question-category">{question.category}</p>
                <p className="question-text">{question.text}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="config-actions">
          <button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Spin up lobby"}
          </button>
        </div>
      </form>

      <form className="panel" id="join-panel" onSubmit={handleJoinGame}>
        <div className="panel-header">
          <div>
            <p className="eyebrow">Join Game</p>
            <h2>Jump into the guesses</h2>
            <p className="tip">Enter the 6-letter lobby code from your host.</p>
          </div>
        </div>
        <label className="field">
          <span>Display name</span>
          <input value={joinForm.username} onChange={(event) => setJoinForm((prev) => ({ ...prev, username: event.target.value }))} />
        </label>
        <label className="field">
          <span>Lobby code</span>
          <input
            value={joinForm.code}
            onChange={(event) => setJoinForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
          />
        </label>
        <label className="field">
          <span>Invite ID (optional)</span>
          <input value={joinForm.inviteId} onChange={(event) => setJoinForm((prev) => ({ ...prev, inviteId: event.target.value }))} />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Joining..." : "Join lobby"}
        </button>
      </form>
    </section>
    </>
  );

  if (!session || !game) {
    return (
      <div className="app-stage">
        <div className="ambient-lights" aria-hidden="true">
          <div className="beam beam-left" />
          <div className="beam beam-right" />
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="grid-overlay" />
        </div>
        <div className="app-shell">
          <header className="hero">
            <div>
              <p className="eyebrow">Bandwagon</p>
              <h1>Jump on the Bandwagon.</h1>
              <p className="lede">
                The social prediction game where you never vote for your favorite—you predict the majority. Part psychology, part strategy,
                pure social fun. Spin up a lobby, invite at least four friends, and crown the best crowd reader.
              </p>
            </div>
          </header>
          {notice && <p className="banner">{notice}</p>}
          {renderLanding()}
          <section className="grid">
            <div className="panel wide">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">How Bandwagon Works</p>
                  <h2>Part strategy, part social experiment</h2>
                </div>
              </div>
              <div className="how-grid">
                <article>
                  <h3>Setup</h3>
                  <ul>
                    <li>Host starts a game & invites at least four friends</li>
                    <li>Pick questions from the bank & optionally add a prize</li>
                    <li>Everyone receives the same questions in order</li>
                  </ul>
                </article>
                <article>
                  <h3>Gameplay</h3>
                  <ul>
                    <li>30-60 seconds to choose the answer you think most people will pick</li>
                    <li>Majority scorers earn 1 point; minority gets zero</li>
                    <li>Predict psychology, not personal favorites</li>
                  </ul>
                </article>
                <article>
                  <h3>Winning</h3>
                  <ul>
                    <li>Top scorers advance to finals; others become voters</li>
                    <li>Finalists face elimination—one wrong answer and you&apos;re out</li>
                    <li>Last predictor standing wins bragging rights and the cash pot</li>
                  </ul>
                </article>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const currentQuestion = currentRound?.question;

  return (
    <div className="app-stage">
      <div className="ambient-lights" aria-hidden="true">
        <div className="beam beam-left" />
        <div className="beam beam-right" />
        <div className="orb orb-one" />
        <div className="orb orb-two" />
        <div className="grid-overlay" />
      </div>
      <div className="app-shell">
        <header className="hero">
          <div>
            <p className="eyebrow">Bandwagon Code · {game.code}</p>
            <h1>Bandwagon Control Deck</h1>
            <p className="lede">Status: {game.status}. Share code {game.code} or send invites directly.</p>
            <div className="hero-stats">
              <div className="stat-tile">
                <p className="stat-label">Players</p>
                <p className="stat-value">{game.participants.length}</p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Timer</p>
                <p className="stat-value">{game.timerSeconds}s</p>
              </div>
              <div className="stat-tile">
                <p className="stat-label">Prize</p>
                <p className="stat-value">${game.prizeAmount}</p>
              </div>
            </div>
          </div>
          <div className="prize-board">
            <p className="eyebrow">You are playing as</p>
            <strong>{me?.user.username ?? "Player"}</strong>
            <p>{me?.isCreator ? "Host controls unlocked" : "Answer the way the crowd will"}</p>
            <div className="spotlights" />
            <button className="ghost" onClick={handleLeave}>
              Leave session
            </button>
          </div>
        </header>

        {notice && <p className="banner">{notice}</p>}

        <section className="grid">
          {showAdmin && (
            <>
              <div className="panel status-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Show Flow</p>
                    <h2>Where you are in the run of show</h2>
                    <p className="tip">Use this to narrate progress out loud — it mirrors what players feel.</p>
                  </div>
                </div>
                <div className="stage-grid">
                  {stageCards.map((stage) => (
                    <div key={stage.key} className={`stage-card ${stage.status}`}>
                      <p className="stage-title">{stage.title}</p>
                      <p className="stage-value">{stage.value}</p>
                      <p className="stage-detail">{stage.detail}</p>
                      <div className="stage-pill">{stage.status === "complete" ? "Done" : stage.status === "active" ? "Live" : "Pending"}</div>
                    </div>
                  ))}
                </div>
                <ShareTools gameCode={game.code} />
              </div>
              <div className="panel admin-panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Creator Tools</p>
                    <h2>Showrunner console</h2>
                    <p className="tip">Start rounds, approve invites, and nudge pending guests.</p>
                  </div>
                  <span className="phase-pill">Admin</span>
                </div>
                <div className="admin-metrics">
                  <div>
                    <p className="stat-label">Invites sent</p>
                    <strong>{inviteStats.sent}</strong>
                  </div>
                  <div>
                    <p className="stat-label">Accepted</p>
                    <strong>{inviteStats.accepted}</strong>
                  </div>
                  <div>
                    <p className="stat-label">Pending</p>
                    <strong>{inviteStats.pending}</strong>
                  </div>
                </div>
                <div className="admin-actions">
                  {game.status === "LOBBY" && <button onClick={handleStartGame}>Start Game</button>}
                  {currentRound && currentRound.status === "ACTIVE" && <button onClick={handleFinalizeRound}>Resolve Round</button>}
                  {!currentRound && game.status !== "COMPLETE" && (
                    <button onClick={handleAdvance}>Next Round</button>
                  )}
                </div>
                <div className="pending-list">
                  <p className="eyebrow">Pending invites</p>
                  {pendingInvites.length === 0 ? (
                    <p className="muted">No invites outstanding. Drop more to keep the lobby full.</p>
                  ) : (
                    <ul>
                      {pendingInvites.map((invite) => (
                        <li key={invite.id}>
                          <div>
                            <strong>{invite.inviteeContact}</strong>
                            <small>Invited by {invite.inviterName}</small>
                          </div>
                          <button className="ghost" onClick={() => handleReminder(invite)}>
                            Poke
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="invite-form inline">
                  <input
                    placeholder="Contact name or email"
                    value={inviteContact}
                    onChange={(event) => setInviteContact(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      handleCreateInvite(inviteContact);
                      setInviteContact("");
                    }}
                  >
                    Send invite
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Question Bank</p>
                <h2>Bandwagon prompts</h2>
                <p className="tip">Players see these in the order below. Finals = last card.</p>
              </div>
            </div>
            <ul className="round-tracker column">
              {game.rounds.map((round) => (
                <li key={round.id} className={`round-chip ${round.status.toLowerCase()}`}>
                  Round {round.index + 1} · {round.question.text} {round.isChampionship && "(Final)"}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Player Roster</p>
                <h2>Who&apos;s on the Bandwagon</h2>
                <p className="tip">Everyone plays the general rounds. Finals promote the top predictors.</p>
              </div>
            </div>
            <ul className="player-list">
              {game.participants.map((participant) => (
                <li key={participant.id}>
                  <span className="player-avatar">{participant.user.username.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <p className="player-name">
                      {participant.user.username}
                      {participant.isCreator && <span className="tag">Creator</span>}
                      {participant.isFinalist && <span className="tag highlight">Finalist</span>}
                    </p>
                    <p className="player-meta">
                      Status: {participant.status}
                      {participant.invitedByName && ` · Invited by ${participant.invitedByName}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="panel wide emphasis">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Live Question</p>
                <h2>{currentQuestion ? currentQuestion.text : "Waiting for next round"}</h2>
                <p className="tip">Remind everyone: answer based on what the group will choose.</p>
              </div>
              <div className="timer">
                <span>⏱</span>
                <strong>{timeLeft}s</strong>
              </div>
            </div>
            {currentQuestion ? (
              <div className="option-grid">
                {questionOptions(currentQuestion).map((option) => (
                  <button
                    key={option.id}
                    className={`option-card ${playerResponse?.selectedOption === option.id ? "selected" : ""}`}
                    disabled={!currentRound || currentRound.status !== "ACTIVE"}
                    onClick={() => handleSubmitResponse(option.id)}
                  >
                    <span>{option.label}</span>
                    <small>{counts[option.id] ?? 0} votes</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">Once the host advances, the next prompt appears here.</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Leaderboard</p>
                <h2>Majority whisperers</h2>
              </div>
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
                {leaderboard.map((participant, index) => (
                  <tr key={participant.id}>
                    <td>{index + 1}</td>
                    <td>{participant.user.username}</td>
                    <td>{participant.totalPoints}</td>
                    <td>{participant.isFinalist ? "Finalist" : participant.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Last Round Recap</p>
                <h2>{previousRound ? previousRound.question.text : "No rounds resolved yet"}</h2>
              </div>
            </div>
            {previousRound ? (
              <ul className="activity-list">
                {questionOptions(previousRound.question).map((option) => {
                  const key = `${previousRound.id}:${option.id}`;
                  const votes = Object.values(game.responses).filter(
                    (response) => response.roundId === previousRound.id && response.selectedOption === option.id,
                  ).length;
                  return (
                    <li key={key}>
                      {option.label} · {votes} vote{votes === 1 ? "" : "s"}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="muted">Finish the first round to unlock live recaps.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default App;

const BandwagonWordmark = () => (
  <div className="wordmark" aria-label="Bandwagon">
    {"BANDWAGON".split("").map((letter, index) => (
      <span key={`${letter}-${index}`} style={{ "--index": index } as CSSProperties}>
        {letter}
      </span>
    ))}
  </div>
);

type ShareToolsProps = {
  gameCode: string;
};

const ShareTools = ({ gameCode }: ShareToolsProps) => {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://bandwagon.game";
  const link = `${origin}?code=${gameCode}`;
  const message = `Join my Bandwagon game! Use code ${gameCode} to predict the crowd.`;
  const smsHref = `sms:?&body=${encodeURIComponent(`${message} ${link}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent("Join my Bandwagon game")}&body=${encodeURIComponent(`${message} ${link}`)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${message} ${link}`);
      window.alert("Share link copied!");
    } catch {
      window.alert("Copy not available, try selecting the link manually.");
    }
  };

  return (
    <div className="share-tools">
      <p className="eyebrow">Share Bandwagon</p>
      <p className="tip">Text, email, or copy the lobby link so players can hop on fast.</p>
      <div className="share-buttons">
        <button type="button" onClick={handleCopy}>
          Copy link
        </button>
        <a href={smsHref}>Text invite</a>
        <a href={emailHref}>Email invite</a>
      </div>
      <code>{link}</code>
    </div>
  );
};
