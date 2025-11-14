export type Question = {
  id: string;
  text: string;
  category: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

export type RoundStatus = "IDLE" | "ACTIVE" | "COMPLETE";
export type ParticipantStatus = "ACTIVE" | "VOTER";
export type GameStatus = "LOBBY" | "RUNNING" | "CHAMPIONSHIP" | "COMPLETE";
export type InviteMode = "LOCKED" | "OPEN";
export type InviteStatus = "PENDING" | "ACCEPTED";

export type GameRound = {
  id: string;
  index: number;
  status: RoundStatus;
  isChampionship: boolean;
  endsAt: string | null;
  question: Question;
};

export type GameParticipant = {
  id: string;
  status: ParticipantStatus;
  totalPoints: number;
  isFinalist: boolean;
  isCreator: boolean;
  invitedById: string | null;
  invitedByName: string | null;
  user: { id: string; username: string };
};

export type GameInvitation = {
  id: string;
  inviteeContact: string;
  status: InviteStatus;
  inviterId: string;
  inviterName: string;
  lastReminderAt: string | null;
};

export type ResponseMap = Record<string, { participantId: string; roundId: string; selectedOption: string }>;

export type GameState = {
  id: string;
  code: string;
  status: GameStatus;
  inviteMode: InviteMode;
  prizeAmount: number;
  timerSeconds: number;
  generalRoundCount: number;
  finalistCount: number;
  currentRoundId: string | null;
  createdAt: string;
  rounds: GameRound[];
  participants: GameParticipant[];
  invitations: GameInvitation[];
  responses: ResponseMap;
};

export const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const request = async <T>(path: string, options?: RequestInit) => {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return null as T;
  return (await res.json()) as T;
};

export const fetchQuestions = () => request<Question[]>("/api/questions");
export const fetchGame = (identifier: string) => request<GameState>(`/api/games/${identifier}`);
export const createGame = (payload: {
  creatorName: string;
  inviteMode: InviteMode;
  timerSeconds: number;
  generalRoundCount: number;
  finalistCount: number;
  prizeAmount: number;
  questionIds: string[];
}) => request<{ gameId: string; code: string; participantId: string }>("/api/games", {
  method: "POST",
  body: JSON.stringify(payload),
});

export const startGame = (gameId: string) => request<GameState>(`/api/games/${gameId}/start`, { method: "POST" });
export const joinGame = (gameId: string, payload: { username: string; inviteId?: string; invitedByParticipantId?: string }) =>
  request<{ participantId: string }>(`/api/games/${gameId}/players`, { method: "POST", body: JSON.stringify(payload) });
export const createInvite = (gameId: string, payload: { inviteeContact: string; inviterParticipantId: string }) =>
  request(`/api/games/${gameId}/invitations`, { method: "POST", body: JSON.stringify(payload) });
export const remindInvite = (inviteId: string) => request(`/api/invitations/${inviteId}/remind`, { method: "POST" });
export const submitResponse = (
  gameId: string,
  roundId: string,
  payload: { participantId: string; selectedOption: string },
) => request<GameState>(`/api/games/${gameId}/rounds/${roundId}/responses`, { method: "POST", body: JSON.stringify(payload) });
export const finalizeRound = (gameId: string, roundId: string) =>
  request<GameState>(`/api/games/${gameId}/rounds/${roundId}/finalize`, { method: "POST" });
export const advanceGame = (gameId: string) => request<GameState>(`/api/games/${gameId}/progress`, { method: "POST" });
