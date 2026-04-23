import { z } from "zod";
import {
  gameMetaSchema,
  joinCodeSchema,
  playerIdSchema,
  playerSchema,
  sessionTokenSchema,
  tableIdSchema,
  tableSchema,
} from "./primitives";

/**
 * REST contracts. Server registers these as NestJS controllers using a Zod
 * validation pipe; client wraps fetch with the same schemas so the API is
 * typed end-to-end without a codegen step.
 */

// GET /games
export const listGamesResponse = z.object({
  games: z.array(gameMetaSchema),
});
export type ListGamesResponse = z.infer<typeof listGamesResponse>;

// POST /players
export const createPlayerBody = z.object({
  name: z.string().min(1).max(40),
});
export const createPlayerResponse = z.object({
  player: playerSchema,
  sessionToken: sessionTokenSchema,
});
export type CreatePlayerBody = z.infer<typeof createPlayerBody>;
export type CreatePlayerResponse = z.infer<typeof createPlayerResponse>;

// GET /players/me
export const getMeResponse = z.object({
  player: playerSchema,
});
export type GetMeResponse = z.infer<typeof getMeResponse>;

// PATCH /players/me
export const updateMeBody = z.object({
  name: z.string().min(1).max(40),
});
export type UpdateMeBody = z.infer<typeof updateMeBody>;

// POST /tables
export const createTableBody = z.object({
  gameType: z.string(),
});
export const createTableResponse = z.object({
  table: tableSchema,
});
export type CreateTableBody = z.infer<typeof createTableBody>;
export type CreateTableResponse = z.infer<typeof createTableResponse>;

// POST /tables/:joinCode/join
export const joinTableParams = z.object({
  joinCode: joinCodeSchema,
});
export const joinTableResponse = z.object({
  table: tableSchema,
});
export type JoinTableResponse = z.infer<typeof joinTableResponse>;

// GET /tables/:id
export const getTableParams = z.object({
  id: tableIdSchema,
});
export const getTableResponse = z.object({
  table: tableSchema,
});
export type GetTableResponse = z.infer<typeof getTableResponse>;

// POST /tables/:id/config
export const updateConfigBody = z.object({
  config: z.unknown(),
});
export type UpdateConfigBody = z.infer<typeof updateConfigBody>;

// POST /tables/:id/start
export const startTableResponse = z.object({
  table: tableSchema,
});
export type StartTableResponse = z.infer<typeof startTableResponse>;

// POST /tables/:id/rematch — resets a finished table back to "waiting"
// so the same group can start a new match without re-entering the lobby.
export const rematchTableResponse = z.object({
  table: tableSchema,
});
export type RematchTableResponse = z.infer<typeof rematchTableResponse>;

// POST /tables/:id/kick
export const kickBody = z.object({
  playerId: playerIdSchema,
});
export type KickBody = z.infer<typeof kickBody>;

// POST /tables/:id/leave — no body; uses session cookie.

// Error response shape used across endpoints.
export const errorResponse = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponse>;

/* ------------------ Dev-only (NODE_ENV != 'production') ------------------ */

// POST /dev/tables/:id/fill — seats auto-generated "Debug N" players so a
// single browser can play-test a multi-player game. Returns the updated
// table. 404 in production builds.
export const fillTableBody = z.object({
  /** Target total seat count; defaults to the game's max. */
  count: z.number().int().positive().optional(),
});
export type FillTableBody = z.infer<typeof fillTableBody>;

export const fillTableResponse = z.object({
  table: tableSchema,
});
export type FillTableResponse = z.infer<typeof fillTableResponse>;
