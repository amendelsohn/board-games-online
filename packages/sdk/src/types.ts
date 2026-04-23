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
 *
 * Storyteller-style games (where the host runs the table without playing)
 * receive ST views via the separate `storytellerView()` method on
 * `GameModule`, NOT through this type — so existing games' `view()`
 * implementations stay narrowly typed.
 */
export type Viewer = PlayerId | "spectator";

/**
 * Framework-level viewer used by the match service / gateway when routing
 * subscriptions. Game modules never see `"storyteller"` through `view()`
 * (it's dispatched to `storytellerView()` instead).
 */
export type RuntimeViewer = Viewer | "storyteller";
