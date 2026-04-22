export type PlayerId = string;
export type TableId = string;
export type MatchId = string;
export type GameType = string;
export type JoinCode = string;
export type PhaseId = string;

export interface Player {
  id: PlayerId;
  name: string;
}

export interface Versioned<S> {
  state: S;
  version: number;
}

export type Viewer = PlayerId | "spectator";
