import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

/** Classic 3-5-7 Nim setup. */
export const INITIAL_PILES = [3, 5, 7] as const;

export type PileIndex = 0 | 1 | 2;

export interface NimLastMove {
  pile: PileIndex;
  count: number;
  by: PlayerId;
}

export interface NimState {
  piles: readonly number[]; // length 3
  current: PlayerId;
  players: readonly [PlayerId, PlayerId];
  winner: PlayerId | null;
  lastMove: NimLastMove | null;
}

export interface NimView {
  piles: number[];
  current: PlayerId;
  players: [PlayerId, PlayerId];
  winner: PlayerId | null;
  lastMove: NimLastMove | null;
}

export const moveSchema = z.object({
  kind: z.literal("take"),
  pile: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  count: z.number().int().refine((n) => n >= 1, {
    message: "Must take at least 1 stone",
  }),
});
export type NimMove = z.infer<typeof moveSchema>;

/** No lobby-time config — piles are fixed at 3-5-7. */
export type NimConfig = Record<string, never>;

export const NIM_TYPE = "nim";
