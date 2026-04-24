import type { GameEvent } from "./game-event";
import type { Rng } from "./rng";
import type { PlayerId } from "./types";

/**
 * Injected into module methods. Gives the module access to framework services
 * without coupling it to the framework implementation. Carries the seeded RNG,
 * the current wall-clock (so modules don't call Date.now directly — easier to
 * test), and timer + event-emit capabilities.
 */
export interface GameContext {
  readonly version: number;
  readonly now: number;
  readonly rng: Rng;

  /**
   * The non-playing host of this match, when one exists (i.e. the table's
   * `hostIsPlayer === false`). Populated for Storyteller-style games so the
   * module can record it in initial state and gate ST-only moves on it.
   * Always undefined for normal games — those modules can ignore this field.
   */
  readonly storytellerId?: PlayerId;

  /** Schedule onTimer(key) to fire at or after `at` (ms epoch). */
  scheduleTimer(key: string, at: number): void;
  cancelTimer(key: string): void;

  /** Emit a side-channel event. Framework routes by `to`. */
  emit(event: GameEvent): void;
}
