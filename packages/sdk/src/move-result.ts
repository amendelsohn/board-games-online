import type { GameEvent } from "./game-event";

export type MoveResult<S> =
  | { ok: true; state: S; events?: GameEvent[] }
  | { ok: false; reason: string };
