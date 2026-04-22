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
export interface GameModule<S, M, Cfg = unknown, V = unknown> {
  readonly type: string;
  readonly displayName: string;
  readonly description: string;
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
    state: Readonly<S>,
    move: M,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<S>;

  /** Fired when a previously-scheduled timer elapses. */
  onTimer?(state: Readonly<S>, key: string, ctx: GameContext): MoveResult<S>;

  /**
   * THE projection boundary. Clients only ever see the output of this
   * function. Strip hidden info (spymaster grid, spy location, etc.) here.
   */
  view(state: Readonly<S>, viewer: Viewer): V;

  phase(state: Readonly<S>): PhaseId;

  /** Who the game is waiting on right now. [] = nobody / simultaneous. */
  currentActors(state: Readonly<S>): PlayerId[];

  isTerminal(state: Readonly<S>): boolean;

  /** null while the game is in progress. */
  outcome(state: Readonly<S>): Outcome | null;
}

export interface GameModuleMetadata {
  readonly type: string;
  readonly displayName: string;
  readonly description: string;
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
    minPlayers: m.minPlayers,
    maxPlayers: m.maxPlayers,
  };
}
