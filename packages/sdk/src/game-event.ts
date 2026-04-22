import type { PlayerId } from "./types";

/** Side-channel event — toasts, sounds, animations. Not part of state. */
export interface GameEvent {
  kind: string;
  payload?: unknown;
  /** Targets: 'all' broadcasts to the room, otherwise a specific player. */
  to?: PlayerId | PlayerId[] | "all";
}
