export type TelemetryEntry = {
  id: number;
  category: "websocket" | "latency";
  message: string;
  timestamp: string;
};

let entryCounter = 0;

const formatTime = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const createWebSocketEntry = (event: string, context?: string): TelemetryEntry => ({
  id: ++entryCounter,
  category: "websocket",
  message: context ? `${event} → ${context}` : event,
  timestamp: formatTime(),
});

export const createLatencyEntry = (playerName: string, latencyMs: number): TelemetryEntry => ({
  id: ++entryCounter,
  category: "latency",
  message: `${playerName} scored in ${latencyMs}ms`,
  timestamp: formatTime(),
});
