import { z } from "zod";

export const playerIdSchema = z.string().uuid();
export const tableIdSchema = z.string().uuid();
export const matchIdSchema = z.string().uuid();
export const sessionTokenSchema = z.string().min(16).max(128);
export const joinCodeSchema = z
  .string()
  .length(4)
  .regex(/^[A-Z]{4}$/);

export type PlayerIdWire = z.infer<typeof playerIdSchema>;
export type TableIdWire = z.infer<typeof tableIdSchema>;
export type MatchIdWire = z.infer<typeof matchIdSchema>;
export type JoinCodeWire = z.infer<typeof joinCodeSchema>;

export const playerSchema = z.object({
  id: playerIdSchema,
  name: z.string().min(1).max(40),
});
export type PlayerWire = z.infer<typeof playerSchema>;

export const tableStatusSchema = z.enum(["waiting", "playing", "finished"]);
export type TableStatus = z.infer<typeof tableStatusSchema>;

export const tableSchema = z.object({
  id: tableIdSchema,
  joinCode: joinCodeSchema,
  gameType: z.string(),
  hostPlayerId: playerIdSchema,
  players: z.array(playerSchema),
  status: tableStatusSchema,
  matchId: matchIdSchema.nullable(),
  /** Game-module-specific lobby config (validated by the module). */
  config: z.unknown(),
  createdAt: z.number(),
});
export type TableWire = z.infer<typeof tableSchema>;

export const gameCategorySchema = z.enum([
  "classic",
  "strategy",
  "cards-dice",
  "party",
]);
export type GameCategoryWire = z.infer<typeof gameCategorySchema>;

export const gameMetaSchema = z.object({
  type: z.string(),
  displayName: z.string(),
  description: z.string(),
  category: gameCategorySchema,
  minPlayers: z.number().int().positive(),
  maxPlayers: z.number().int().positive(),
});
export type GameMetaWire = z.infer<typeof gameMetaSchema>;
