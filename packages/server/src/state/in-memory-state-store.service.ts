import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type {
  MatchId,
  StateStore,
  TimerFirer,
  Unsubscribe,
  Versioned,
} from '@bgo/sdk';

/**
 * Single-process, single-threaded in-memory state store. No concurrency
 * hazards because JS is single-threaded — but writes bump a version counter
 * so the Redis impl (a future drop-in replacement) can layer on CAS.
 *
 * Timers run in the local event loop. When we move to multi-process we'll
 * swap this for a Redis-backed sorted-set scheduler.
 */
@Injectable()
export class InMemoryStateStore implements StateStore {
  private readonly log = new Logger(InMemoryStateStore.name);
  private readonly states = new Map<MatchId, Versioned<unknown>>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly bus = new EventEmitter();
  private timerFirer: TimerFirer | null = null;

  /**
   * Wired at module init so the store can dispatch back to the match
   * service when a timer elapses, without circular DI.
   */
  setTimerFirer(firer: TimerFirer): void {
    this.timerFirer = firer;
  }

  async get<S>(matchId: MatchId): Promise<Versioned<S> | null> {
    return (this.states.get(matchId) as Versioned<S> | undefined) ?? null;
  }

  async set<S>(matchId: MatchId, next: S): Promise<Versioned<S>> {
    const existing = this.states.get(matchId);
    const version = (existing?.version ?? -1) + 1;
    const versioned: Versioned<S> = { state: next, version };
    this.states.set(matchId, versioned);
    return versioned;
  }

  async create<S>(matchId: MatchId, initial: S): Promise<Versioned<S>> {
    if (this.states.has(matchId)) {
      throw new Error(`State already exists for match ${matchId}`);
    }
    const versioned: Versioned<S> = { state: initial, version: 0 };
    this.states.set(matchId, versioned);
    return versioned;
  }

  async delete(matchId: MatchId): Promise<void> {
    this.states.delete(matchId);
    for (const [key, handle] of this.timers) {
      if (key.startsWith(`${matchId}:`)) {
        clearTimeout(handle);
        this.timers.delete(key);
      }
    }
    this.bus.removeAllListeners(`match:${matchId}`);
  }

  async scheduleTimer(
    matchId: MatchId,
    key: string,
    at: number,
  ): Promise<void> {
    const fullKey = `${matchId}:${key}`;
    const existing = this.timers.get(fullKey);
    if (existing) clearTimeout(existing);
    const delay = Math.max(0, at - Date.now());
    const handle = setTimeout(() => {
      this.timers.delete(fullKey);
      if (this.timerFirer) {
        Promise.resolve(this.timerFirer(matchId, key)).catch((err) => {
          this.log.error(
            `Timer firer threw for ${fullKey}: ${(err as Error).message}`,
          );
        });
      }
    }, delay);
    this.timers.set(fullKey, handle);
  }

  async cancelTimer(matchId: MatchId, key: string): Promise<void> {
    const fullKey = `${matchId}:${key}`;
    const handle = this.timers.get(fullKey);
    if (handle) {
      clearTimeout(handle);
      this.timers.delete(fullKey);
    }
  }

  subscribe(
    matchId: MatchId,
    fn: (v: Versioned<unknown>) => void,
  ): Unsubscribe {
    const event = `match:${matchId}`;
    this.bus.on(event, fn);
    return () => this.bus.off(event, fn);
  }

  async publish(matchId: MatchId, v: Versioned<unknown>): Promise<void> {
    this.bus.emit(`match:${matchId}`, v);
  }
}
