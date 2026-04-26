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

/**
 * Who is looking at the game state, from a game module's perspective.
 *  - A `PlayerId` is a seated participant.
 *  - `"spectator"` is anyone watching but not seated.
 */
export type Viewer = PlayerId | "spectator";
