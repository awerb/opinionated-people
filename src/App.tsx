import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { GameParticipant, GameRound, GameState, InviteMode, Question } from "./api";
import {
  API_BASE,
  advanceGame,
  createGame,
  fetchGame,
  fetchQuestions,
  finalizeRound,
  joinGame,
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
    text: "Favorite pizza topping?",
    category: "Food",
    optionA: "Cheese",
    optionB: "Pepperoni",
    optionC: "Mushroom",
    optionD: "Olive",
  },
  {
    id: "bandwagon-q2",
    text: "Perfect bedtime on a weeknight?",
    category: "Daily Life",
    optionA: "9 PM",
    optionB: "10 PM",
    optionC: "11 PM",
    optionD: "Midnight",
  },
  {
    id: "bandwagon-q3",
    text: "Best snack cracker?",
    category: "Food",
    optionA: "Ritz",
    optionB: "Saltines",
    optionC: "Triscuits",
    optionD: "Cheez-Its",
  },
  {
    id: "bandwagon-q4",
    text: "Go-to coffee order?",
    category: "Drinks",
    optionA: "Black coffee",
    optionB: "Latte",
    optionC: "Cold brew",
    optionD: "Iced coffee",
  },
  {
    id: "bandwagon-q5",
    text: "Best sports league to watch?",
    category: "Sports",
    optionA: "NFL",
    optionB: "NBA",
    optionC: "Premier League",
    optionD: "MLB",
  },
  {
    id: "bandwagon-q6",
    text: "Ultimate comfort movie genre?",
    category: "Entertainment",
    optionA: "Comedy",
    optionB: "Rom-com",
    optionC: "Action",
    optionD: "Animated",
  },
  {
    id: "bandwagon-q7",
    text: "Dream weekend getaway?",
    category: "Travel",
    optionA: "Beach",
    optionB: "Mountain",
    optionC: "City escape",
    optionD: "Staycation",
  },
  {
    id: "bandwagon-q8",
    text: "Best phone notification sound?",
    category: "Tech",
    optionA: "Default ding",
    optionB: "Chime",
    optionC: "Vibrate only",
    optionD: "Muted always",
  },
  {
    id: "bandwagon-q9",
    text: "Favorite breakfast carb?",
    category: "Food",
    optionA: "Bagel",
    optionB: "Pancakes",
    optionC: "Toast",
    optionD: "Waffles",
  },
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
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [landingTab, setLandingTab] = useState<"host" | "player" | "how">("host");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

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
        detail: game.status === "LOBBY" ? "Share link to invite" : "Lobby ready",
        status: game.status === "LOBBY" ? "active" : "complete",
      },
      {
        key: "players",
        title: "Players",
        value: `${game.participants.length} joined`,
        detail: game.participants.length >= 4 ? "Ready to start" : "Need 4+ to play",
        status: game.participants.length >= 4 ? "complete" : game.participants.length > 0 ? "active" : "pending",
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
  }, [game, currentRound, completedRounds, finalsReady, timeLeft]);

  const syncGame = async (identifier: string) => {
    const next = await fetchGame(identifier);
    setGame(next);
  };

  const handleQuickStart = async () => {
    try {
      setLoading(true);
      setNotice(null);
      // Use default form settings with first 4 questions
      const quickStartConfig: HostFormState = {
        ...defaultHostForm,
        questionIds: questions.slice(0, 4).map((q) => q.id),
      };
      const payload = await createGame(quickStartConfig);
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

  const handleSelectRecommended = () => {
    const recommended = questions.slice(0, hostForm.generalRoundCount + 1).map((q) => q.id);
    setHostForm((prev) => ({ ...prev, questionIds: recommended }));
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

  // Detect URL parameters for share links
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !session) {
      setJoinForm((prev) => ({ ...prev, code: code.toUpperCase() }));
      setLandingTab('player');
    }
  }, [session]);

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
        setNotice("Couldn't reach the question bank, showing sample prompts instead.");
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

  const renderLanding = () => (
    <>
      <section className="landing-hero-simple">
        <BandwagonWordmark />
        <h1>Jump on the Bandwagon</h1>
        <p className="hero-subtitle">The social prediction game where you guess what the majority will choose. Part psychology, part strategy, pure fun.</p>
      </section>
      <div className="landing-tabs">
        <button type="button" className={landingTab === "host" ? "active" : ""} onClick={() => setLandingTab("host")}>
          Host Game
        </button>
        <button type="button" className={landingTab === "player" ? "active" : ""} onClick={() => setLandingTab("player")}>
          Join Game
        </button>
        <button type="button" className={landingTab === "how" ? "active" : ""} onClick={() => setLandingTab("how")}>
          How It Works
        </button>
      </div>
      {landingTab === "host" && (
        <section className="host-flow">
          <div className="panel center">
            <div className="panel-header">
              <div>
                <h2>Create Your Game</h2>
                <p className="tip">Start a game instantly with default settings, or customize everything.</p>
              </div>
            </div>
            <div className="quick-start-section">
              <button type="button" className="primary-cta large" onClick={handleQuickStart} disabled={loading}>
                {loading ? "Creating..." : "Create Game Now"}
              </button>
              <p className="or-divider">or</p>
              <button
                type="button"
                className="secondary-link"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              >
                {showAdvancedSettings ? "Hide" : "Show"} Advanced Settings
              </button>
            </div>

            {showAdvancedSettings && (
              <form className="advanced-form" onSubmit={handleCreateGame}>
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

                <div className="question-section">
                  <div className="question-header">
                    <h3>Question Selection</h3>
                    <button
                      type="button"
                      className="select-recommended"
                      onClick={handleSelectRecommended}
                    >
                      Select Recommended ({hostForm.generalRoundCount + 1})
                    </button>
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
                </div>
                <div className="config-actions">
                  <button type="submit" disabled={loading}>
                    {loading ? "Creating..." : "Create Custom Game"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      )}
      {landingTab === "player" && (
        <section className="player-flow">
          <div className="panel center">
            <div className="panel-header">
              <div>
                <h2>Join a Game</h2>
                <p className="tip">Enter the game code from your host to join the fun.</p>
              </div>
            </div>
            <form className="join-form" onSubmit={handleJoinGame}>
              <label className="field">
                <span>Your Name</span>
                <input
                  value={joinForm.username}
                  onChange={(event) => setJoinForm((prev) => ({ ...prev, username: event.target.value }))}
                  placeholder="Enter your name"
                  autoFocus
                />
              </label>
              <label className="field">
                <span>Game Code</span>
                <input
                  value={joinForm.code}
                  onChange={(event) => setJoinForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                  placeholder="6-letter code"
                  maxLength={6}
                />
              </label>
              <button type="submit" disabled={loading} className="primary-cta">
                {loading ? "Joining..." : "Join Game"}
              </button>
            </form>
          </div>
        </section>
      )}
      {landingTab === "how" && (
        <section className="grid">
          <div className="panel wide">
            <div className="panel-header">
              <div>
                <p className="eyebrow">About Bandwagon</p>
                <h2>Why predict the crowd?</h2>
                <p className="tip">A quick tour of the show flow.</p>
              </div>
            </div>
            <div className="how-grid">
              <article>
                <h3>Setup</h3>
                <ul>
                  <li>Host invites 4+ players and curates the question stack</li>
                  <li>Optionally add a prize pool and timer length</li>
                  <li>Players hop in via share link or lobby code</li>
                </ul>
              </article>
              <article>
                <h3>Gameplay</h3>
                <ul>
                  <li>Questions show four options — tap what you expect the majority to pick</li>
                  <li>Majority scorers get 1 point, minority earns zero</li>
                  <li>Timer forces fast instincts: 30–60 seconds</li>
                </ul>
              </article>
              <article>
                <h3>Winning</h3>
                <ul>
                  <li>Top predictors after general rounds become finalists</li>
                  <li>Finalists battle elimination style while voters spectate</li>
                  <li>Last predictor standing wins cash + bragging rights</li>
                </ul>
              </article>
            </div>
          </div>
        </section>
      )}
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
          {notice && <p className="banner">{notice}</p>}
          {renderLanding()}
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
            <p className="lede">Status: {game.status}. Share the game link to invite players.</p>
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
                    <h2>Game Controls</h2>
                    <p className="tip">Start rounds and advance the game as players respond.</p>
                  </div>
                  <span className="phase-pill">Admin</span>
                </div>
                <div className="admin-actions">
                  {game.status === "LOBBY" && <button onClick={handleStartGame}>Start Game</button>}
                  {currentRound && currentRound.status === "ACTIVE" && <button onClick={handleFinalizeRound}>Resolve Round</button>}
                  {!currentRound && game.status !== "COMPLETE" && (
                    <button onClick={handleAdvance}>Next Round</button>
                  )}
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
