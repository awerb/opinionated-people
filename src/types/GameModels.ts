export type GamePhase = "lobby" | "general" | "championship" | "complete";

export interface GameParticipant {
  id: string;
  displayName: string;
  score: number;
  eliminated: boolean;
  finalist: boolean;
  voterOnly: boolean;
}
