import "dotenv/config";
import http from "http";
import express, { NextFunction, Request, RequestHandler, Response } from "express";
import cors from "cors";
import { WebSocketServer, WebSocket } from "ws";
import { z } from "zod";
import {
  createGame,
  createInvitation,
  finalizeRound,
  fetchGameByCodeOrId,
  joinGame,
  listQuestions,
  progressGame,
  recordResponse,
  remindInvitation,
  serializeGame,
  startGame,
} from "./gameService";

const app = express();
const originList = (process.env.CLIENT_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) {
      callback(null, true);
      return;
    }
    if (originList.includes("*") || originList.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown;

const asyncHandler = (handler: AsyncHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.get(
  "/api/questions",
  asyncHandler(async (_req, res) => {
    const items = await listQuestions();
    res.json(items);
  }),
);

app.post(
  "/api/games",
  asyncHandler(async (req, res) => {
    const schema = z.object({
      creatorName: z.string(),
      inviteMode: z.enum(["LOCKED", "OPEN"]),
      timerSeconds: z.number().min(20).max(90),
      generalRoundCount: z.number().min(1).max(5),
      finalistCount: z.number().min(2).max(6),
      prizeAmount: z.number().min(0),
      questionIds: z.array(z.string()).min(2),
    });
    const body = schema.parse(req.body);
    const result = await createGame(body);
    res.status(201).json(result);
  }),
);

app.get("/api/games/:identifier", asyncHandler(async (req, res) => {
  const { identifier } = req.params;
  const game = await fetchGameByCodeOrId(identifier);
  if (!game) {
    res.status(404).json({ error: "Game not found" });
    return;
  }
  res.json(game);
}));

app.post("/api/games/:gameId/start", asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const state = await startGame(gameId);
  await publish(gameId);
  res.json(state);
}));

app.post("/api/games/:gameId/players", asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const schema = z.object({ username: z.string(), inviteId: z.string().optional(), invitedByParticipantId: z.string().optional() });
  const body = schema.parse(req.body);
  const result = await joinGame(gameId, body);
  await publish(gameId);
  res.status(201).json(result);
}));

app.post("/api/games/:gameId/invitations", asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const schema = z.object({ inviteeContact: z.string(), inviterParticipantId: z.string() });
  const body = schema.parse(req.body);
  const invite = await createInvitation(gameId, body);
  await publish(gameId);
  res.status(201).json(invite);
}));

app.post("/api/invitations/:inviteId/remind", asyncHandler(async (req, res) => {
  const { inviteId } = req.params;
  const invite = await remindInvitation(inviteId);
  await publish(invite.gameId);
  res.json(invite);
}));

app.post("/api/games/:gameId/rounds/:roundId/responses", asyncHandler(async (req, res) => {
  const { gameId, roundId } = req.params;
  const schema = z.object({ participantId: z.string(), selectedOption: z.string() });
  const body = schema.parse(req.body);
  const state = await recordResponse(gameId, roundId, body);
  await publish(gameId);
  res.json(state);
}));

app.post("/api/games/:gameId/rounds/:roundId/finalize", asyncHandler(async (req, res) => {
  const { gameId, roundId } = req.params;
  const state = await finalizeRound(gameId, roundId);
  await publish(gameId);
  res.json(state);
}));

app.post("/api/games/:gameId/progress", asyncHandler(async (req, res) => {
  const { gameId } = req.params;
  const state = await progressGame(gameId);
  await publish(gameId);
  res.json(state);
}));

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  // eslint-disable-next-line no-console
  console.error(err);
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: err.flatten() });
    return;
  }
  res.status(500).json({ error: (err as Error).message });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

const rooms = new Map<string, Set<WebSocket>>();

function ensureRoom(gameId: string) {
  if (!rooms.has(gameId)) {
    rooms.set(gameId, new Set());
  }
  return rooms.get(gameId)!;
}

async function publish(gameId: string) {
  const payload = await serializeGame(gameId);
  if (!payload) return;
  const message = JSON.stringify({ type: "GAME_UPDATE", data: payload });
  const sockets = rooms.get(gameId);
  sockets?.forEach((socket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(message);
    }
  });
}

wss.on("connection", (socket, request) => {
  try {
    const url = new URL(request.url ?? "", "http://localhost");
    const gameId = url.searchParams.get("gameId");
    if (!gameId) {
      socket.close();
      return;
    }
    const room = ensureRoom(gameId);
    room.add(socket);
    socket.on("close", () => {
      room.delete(socket);
    });
  } catch {
    socket.close();
  }
});

const port = Number(process.env.PORT ?? 4000);
server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
});
