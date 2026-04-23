import type { GameContext } from "./game-context";
import type { MoveResult } from "./move-result";
import type { Outcome } from "./outcome";
import type { PhaseId, Player, PlayerId, Viewer } from "./types";

/**
 * The core server-side game module interface.
 *
 * Type params:
 *   S   — full authoritative state (never leaves the server raw)
 *   M   — move discriminated union
 *   Cfg — lobby-supplied configuration (team assignments, variants, etc.)
 *   V   — per-player view shape (what actually goes over the wire)
 */
/**
 * High-level grouping used for organizing the game catalog in UI.
 *  - classic:    simple abstract 2-player games (tic-tac-toe, connect four, rps…)
 *  - strategy:   deeper 2-player abstract/deduction games (checkers, reversi, battleship…)
 *  - cards-dice: traditional card or dice games (hearts, yahtzee, liar's dice…)
 *  - party:      group games built around bluffing / hidden roles / word play
 */
export type GameCategory = "classic" | "strategy" | "cards-dice" | "party";

export interface GameModule<S, M, Cfg = unknown, V = unknown> {
  readonly type: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: GameCategory;
  readonly minPlayers: number;
  readonly maxPlayers: number;

  /**
   * Validate and normalize host-supplied lobby config. Throw to reject.
   * Called before `createInitialState`.
   */
  validateConfig(cfg: unknown): Cfg;

  /** Produce the default config when a lobby is first created. */
  defaultConfig(): Cfg;

  /** Build the authoritative initial state. Deterministic given ctx.rng + cfg. */
  createInitialState(players: Player[], cfg: Cfg, ctx: GameContext): S;

  /**
   * Apply a validated move. Framework runs Zod schema validation first, then
   * calls this. Return `{ ok: false, reason }` for game-logic rejections.
   */
  handleMove(
    state: S,
    move: M,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<S>;

  /** Fired when a previously-scheduled timer elapses. */
  onTimer?(state: S, key: string, ctx: GameContext): MoveResult<S>;

  /**
   * THE projection boundary. Clients only ever see the output of this
   * function. Strip hidden info (spymaster grid, spy location, etc.) here.
   */
  view(state: S, viewer: Viewer): V;

  phase(state: S): PhaseId;

  /** Who the game is waiting on right now. [] = nobody / simultaneous. */
  currentActors(state: S): PlayerId[];

  isTerminal(state: S): boolean;

  /** null while the game is in progress. */
  outcome(state: S): Outcome | null;
}

export interface GameModuleMetadata {
  readonly type: string;
  readonly displayName: string;
  readonly description: string;
  readonly category: GameCategory;
  readonly minPlayers: number;
  readonly maxPlayers: number;
}

export function metadataOf<S, M, Cfg, V>(
  m: GameModule<S, M, Cfg, V>,
): GameModuleMetadata {
  return {
    type: m.type,
    displayName: m.displayName,
    description: m.description,
    category: m.category,
    minPlayers: m.minPlayers,
    maxPlayers: m.maxPlayers,
  };
}
