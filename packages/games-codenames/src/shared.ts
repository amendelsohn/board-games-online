import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const CODENAMES_TYPE = "codenames";

export type Team = "red" | "blue";
export type Role = "spymaster" | "operative";
export type CardRole = Team | "neutral" | "assassin";

export const GRID_SIZE = 25; // 5x5
export const GRID_COLS = 5;

export interface Card {
  word: string;
  role: CardRole;
  revealed: boolean;
}

export interface Clue {
  word: string;
  /** Number the spymaster declared — allowed guesses are count + 1. */
  count: number;
}

export interface CodenamesState {
  grid: Card[];
  teams: Record<PlayerId, Team>;
  roles: Record<PlayerId, Role>;
  turn: Team;
  phase: "cluing" | "guessing" | "gameOver";
  clue: Clue | null;
  guessesLeft: number;
  remaining: Record<Team, number>;
  winner: Team | null;
  winReason: "lastCard" | "assassin" | "forfeit" | null;
}

/** What each player actually receives over the wire. */
export interface CodenamesCardView {
  word: string;
  /** Non-null only when the card is revealed OR the viewer is a spymaster on the same team, OR terminal. */
  role: CardRole | null;
  revealed: boolean;
}

export interface CodenamesView {
  grid: CodenamesCardView[];
  teams: Record<PlayerId, Team>;
  roles: Record<PlayerId, Role>;
  turn: Team;
  phase: CodenamesState["phase"];
  clue: Clue | null;
  guessesLeft: number;
  remaining: Record<Team, number>;
  winner: Team | null;
  winReason: CodenamesState["winReason"];
  /** This is the viewer's computed view: is_spymaster, viewer_team, etc. */
  viewerRole: Role | null;
  viewerTeam: Team | null;
}

// ------------------------- Config -------------------------

export const configSchema = z.object({
  teams: z.record(z.enum(["red", "blue"])).default({}),
  spymasters: z
    .object({
      red: z.string().optional(),
      blue: z.string().optional(),
    })
    .default({}),
  startingTeam: z.enum(["red", "blue"]).optional(),
});
export type CodenamesConfig = z.infer<typeof configSchema>;

// ------------------------- Moves -------------------------

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("giveClue"),
    word: z.string().min(1).max(40),
    count: z.number().int().min(0).max(9),
  }),
  z.object({
    kind: z.literal("guess"),
    cardIndex: z.number().int().min(0).max(GRID_SIZE - 1),
  }),
  z.object({ kind: z.literal("endGuessing") }),
]);
export type CodenamesMove = z.infer<typeof moveSchema>;
