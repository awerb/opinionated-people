import { useEffect, useMemo, useRef, useState } from "react";
import Timer from "../frontend/components/Timer";
import "./App.css";

type EventPayload = {
  event: string;
  roundId: string;
  duration?: number;
  remaining?: number;
  questionId?: string;
  results?: Array<{ playerId: string; answer: string; isAutoSubmitted: boolean }>;
};

const WS_BASE = import.meta.env.VITE_REALTIME_URL ?? "ws://localhost:8000/ws";
const ROUND_ID = "demo-round";

function App() {
  const [connectionState, setConnectionState] = useState("connecting");
  const [eventLog, setEventLog] = useState<string[]>([]);
  const [timerConfig, setTimerConfig] = useState<{ duration: number; label: string } | null>(null);
  const [syncedRemaining, setSyncedRemaining] = useState<number>();
  const [roundResults, setRoundResults] = useState<EventPayload["results"]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const playerId = useMemo(
    () => `player-${Math.random().toString(36).slice(2, 8)}`,
    []
  );

  useEffect(() => {
    const url = `${WS_BASE}/${ROUND_ID}/${playerId}`;
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => setConnectionState("connected");
      socket.onerror = () => setConnectionState("error");
      socket.onclose = () => setConnectionState("disconnected");
      socket.onmessage = (message) => {
        const payload: EventPayload = JSON.parse(message.data);
        setEventLog((current) => [`${new Date().toLocaleTimeString()} – ${payload.event}`, ...current].slice(0, 8));
        if (payload.event === "question:start" && payload.duration) {
          setTimerConfig({ duration: payload.duration, label: `Question ${payload.questionId}` });
          setRoundResults([]);
          setSyncedRemaining(undefined);
        }
        if (payload.event === "question:countdown" && typeof payload.remaining === "number") {
          setSyncedRemaining(payload.remaining * 1000);
        }
        if (payload.event === "round:results") {
          setRoundResults(payload.results ?? []);
          setSyncedRemaining(0);
        }
      };
      return () => socket.close();
    } catch (error) {
      setConnectionState("error");
    }
  }, [playerId]);

  const handleStart = () => {
    setEventLog([]);
    const payload = {
      type: "start_round",
      roundId: ROUND_ID,
      duration: 15,
      questionId: "demo",
      players: [playerId, "remote-1", "remote-2"],
      options: ["A", "B", "C"],
    };
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      // local fallback to keep the UI functional when the backend is not available
      setTimerConfig({ duration: payload.duration, label: "Local demo" });
      setSyncedRemaining(undefined);
    }
  };

  const handleTimeout = () => {
    setEventLog((current) => [`${new Date().toLocaleTimeString()} – timer expired locally`, ...current]);
  };

  return (
    <div className="app">
      <div className="card">
        <h1>Opinionated People</h1>
        <p>Real-time countdown prototype</p>
        <button onClick={handleStart} disabled={connectionState === "connecting"}>
          {connectionState === "connected" ? "Start Round" : "Start Locally"}
        </button>
        {timerConfig ? (
          <Timer
            duration={timerConfig.duration}
            label={timerConfig.label}
            isRunning
            syncedRemainingMs={syncedRemaining}
            onExpire={handleTimeout}
          />
        ) : null}
        {roundResults && roundResults.length > 0 ? (
          <div className="event-log">
            <h3>Round results</h3>
            <ul>
              {roundResults.map((result) => (
                <li key={result.playerId}>
                  <strong>{result.playerId}</strong>: {result.answer || "—"}
                  {result.isAutoSubmitted ? " (auto)" : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="event-log">
          <h3>Event log</h3>
          <ul>
            {eventLog.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
