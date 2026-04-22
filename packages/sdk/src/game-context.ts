import type { GameEvent } from "./game-event";
import type { Rng } from "./rng";

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

  /** Schedule onTimer(key) to fire at or after `at` (ms epoch). */
  scheduleTimer(key: string, at: number): void;
  cancelTimer(key: string): void;

  /** Emit a side-channel event. Framework routes by `to`. */
  emit(event: GameEvent): void;
}
