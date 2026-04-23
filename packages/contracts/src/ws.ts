import { z } from "zod";
import {
  matchIdSchema,
  playerIdSchema,
  sessionTokenSchema,
} from "./primitives";

/**
 * WebSocket event contracts. Events are namespaced by direction:
 *   C2S — client → server
 *   S2C — server → client
 *
 * Payloads are validated with Zod in the gateway before dispatch. The server
 * never trusts client-supplied fields except through these schemas.
 */

// ---------- Client → Server ----------

export const subscribeMatchPayload = z.object({
  matchId: matchIdSchema,
  playerId: playerIdSchema,
  sessionToken: sessionTokenSchema,
  /**
   * Dev-only: subscribe as a different seated player. The authenticated
   * session must still be valid and seated at the same table. Ignored when
   * the server is running in production.
   */
  viewerId: playerIdSchema.optional(),
});
export type SubscribeMatchPayload = z.infer<typeof subscribeMatchPayload>;

export const submitMovePayload = z.object({
  matchId: matchIdSchema,
  /** Module-specific move shape; module validates via its own Zod schema. */
  move: z.unknown(),
  /**
   * Dev-only: submit the move on behalf of a different seated player. The
   * authenticated session must still be valid and seated at the same table.
   * Ignored when the server is running in production.
   */
  actor: playerIdSchema.optional(),
});
export type SubmitMovePayload = z.infer<typeof submitMovePayload>;

export const leaveMatchPayload = z.object({
  matchId: matchIdSchema,
});
export type LeaveMatchPayload = z.infer<typeof leaveMatchPayload>;

// ---------- Server → Client ----------

export const viewUpdatedPayload = z.object({
  matchId: matchIdSchema,
  version: z.number().int().nonnegative(),
  phase: z.string(),
  currentActors: z.array(playerIdSchema),
  /** Module-specific view shape — opaque to the framework. */
  view: z.unknown(),
  isTerminal: z.boolean(),
});
export type ViewUpdatedPayload = z.infer<typeof viewUpdatedPayload>;

export const phaseChangedPayload = z.object({
  matchId: matchIdSchema,
  phase: z.string(),
});
export type PhaseChangedPayload = z.infer<typeof phaseChangedPayload>;

export const matchEventPayload = z.object({
  matchId: matchIdSchema,
  event: z.object({
    kind: z.string(),
    payload: z.unknown().optional(),
  }),
});
export type MatchEventPayload = z.infer<typeof matchEventPayload>;

export const matchEndedPayload = z.object({
  matchId: matchIdSchema,
  outcome: z.union([
    z.object({
      kind: z.literal("solo"),
      winners: z.array(playerIdSchema),
      losers: z.array(playerIdSchema),
    }),
    z.object({
      kind: z.literal("team"),
      winningTeam: z.string(),
      losingTeams: z.array(z.string()),
    }),
    z.object({ kind: z.literal("draw") }),
  ]),
});
export type MatchEndedPayload = z.infer<typeof matchEndedPayload>;

export const wsErrorPayload = z.object({
  code: z.string(),
  message: z.string(),
});
export type WsErrorPayload = z.infer<typeof wsErrorPayload>;

// Event name constants — use these everywhere so there's no string drift.
export const WS = {
  // C → S
  SUBSCRIBE_MATCH: "subscribe_match",
  SUBMIT_MOVE: "submit_move",
  LEAVE_MATCH: "leave_match",
  // S → C
  VIEW_UPDATED: "view_updated",
  PHASE_CHANGED: "phase_changed",
  MATCH_EVENT: "match_event",
  MATCH_ENDED: "match_ended",
  ERROR: "ws_error",
} as const;
