import type { MatchId, Versioned } from "./types";

export type Unsubscribe = () => void;

/**
 * Pluggable state persistence. v1 uses an in-memory Map impl; Redis is the
 * migration target when restart durability / horizontal scaling matters.
 *
 * `set` is a plain write today (single Node process, no races). When we add a
 * second process, we'll add `compareAndSet(matchId, expectedVersion, next)`
 * without changing the rest of the interface.
 */
export interface StateStore {
  get<S>(matchId: MatchId): Promise<Versioned<S> | null>;
  set<S>(matchId: MatchId, next: S): Promise<Versioned<S>>;
  create<S>(matchId: MatchId, initial: S): Promise<Versioned<S>>;
  delete(matchId: MatchId): Promise<void>;

  scheduleTimer(matchId: MatchId, key: string, at: number): Promise<void>;
  cancelTimer(matchId: MatchId, key: string): Promise<void>;

  subscribe(
    matchId: MatchId,
    fn: (v: Versioned<unknown>) => void,
  ): Unsubscribe;
  publish(matchId: MatchId, v: Versioned<unknown>): Promise<void>;
}

export interface TimerFirer {
  /** Called by the store when a scheduled timer elapses. */
  (matchId: MatchId, key: string): void | Promise<void>;
}
