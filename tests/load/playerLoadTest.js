import { EventEmitter } from "node:events";
import { randomInt } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";

class MockWebSocket extends EventEmitter {
  constructor(id) {
    super();
    this.id = id;
    queueMicrotask(() => this.emit("open"));
  }

  send(payload) {
    this.emit("message", payload);
  }

  close() {
    this.emit("close");
  }
}

const simulatePlayer = async (playerId) => {
  const socket = new MockWebSocket(playerId);
  const timeline = [];

  socket.on("open", () => {
    timeline.push({ event: "open", at: Date.now() });
    socket.send(JSON.stringify({ type: "join", playerId }));
  });

  socket.on("message", (payload) => {
    timeline.push({ event: "message", at: Date.now(), payload });
  });

  socket.on("close", () => {
    timeline.push({ event: "close", at: Date.now() });
  });

  await wait(randomInt(50, 200));
  socket.send(JSON.stringify({ type: "opinion", vote: randomInt(0, 3) }));
  await wait(randomInt(50, 200));
  socket.send(JSON.stringify({ type: "score", delta: 1 }));
  await wait(randomInt(50, 200));
  socket.close();

  return timeline;
};

const runLoad = async () => {
  const desired = Number(process.argv[2] ?? 10);
  if (Number.isNaN(desired) || desired < 10 || desired > 100) {
    throw new Error("Provide a player count between 10 and 100");
  }

  const start = Date.now();
  const simulations = Array.from({ length: desired }, (_, index) => simulatePlayer(index + 1));
  const timelines = await Promise.all(simulations);
  const duration = Date.now() - start;

  const aggregate = timelines.reduce(
    (acc, timeline) => {
      const joinTime = timeline.find((event) => event.event === "open")?.at;
      const scoreTime = timeline.find((event) => event.event === "message" && event.payload.includes("score"))?.at;
      if (joinTime && scoreTime) {
        acc.latencies.push(scoreTime - joinTime);
      }
      return acc;
    },
    { latencies: [] },
  );

  const latencyAvg =
    aggregate.latencies.reduce((sum, latency) => sum + latency, 0) / (aggregate.latencies.length || 1);

  console.log(
    JSON.stringify(
      {
        playersSimulated: desired,
        durationMs: duration,
        averageScoreLatencyMs: Number(latencyAvg.toFixed(2)),
      },
      null,
      2,
    ),
  );
};

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runLoad().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
