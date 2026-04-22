import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const MASTERMIND_TYPE = "mastermind";

/** Six-peg palette. Short tokens so the wire format stays tight. */
export const COLORS = ["R", "O", "Y", "G", "B", "V"] as const;
export type Color = (typeof COLORS)[number];

export const CODE_LENGTH = 4;
export const MAX_GUESSES = 10;

export type MastermindPhase = "setting" | "guessing" | "gameOver";

export interface GuessFeedback {
  /** Pegs in the correct position AND correct color. */
  black: number;
  /** Pegs of a color that appears elsewhere in the code, wrong position. */
  white: number;
}

export interface GuessRecord {
  code: Color[];
  feedback: GuessFeedback;
}

export interface MastermindState {
  phase: MastermindPhase;
  /** The two player ids, in seat order. */
  players: [PlayerId, PlayerId];
  /** Secret code each player has set for their opponent to crack. */
  secrets: Record<PlayerId, Color[] | null>;
  /** Guesses each player has made against their opponent's secret. */
  guesses: Record<PlayerId, GuessRecord[]>;
  /** True once a player has submitted an all-black guess. */
  cracked: Record<PlayerId, boolean>;
  /** Timestamp at which the guessing phase started (ms). */
  startedGuessingAt: number | null;
  winner: PlayerId | null;
  isDraw: boolean;
}

// ------------------------- Per-player view -------------------------

export interface OpponentBoardView {
  /** Their guesses so far, with feedback. */
  guesses: GuessRecord[];
  /** True if they have finalized their secret code. */
  codeSet: boolean;
  /** True if they have cracked your code. */
  cracked: boolean;
  /** Their secret — only revealed when the game is over. */
  secret: Color[] | null;
}

export interface MastermindView {
  phase: MastermindPhase;
  /** Seat order. */
  players: [PlayerId, PlayerId];
  /** The viewer's own secret code — null if viewer is a spectator or hasn't set it yet. */
  mySecret: Color[] | null;
  /** The viewer's guesses against their opponent, with feedback. */
  myGuesses: GuessRecord[];
  /** True if the viewer has cracked the opponent's code. */
  iCracked: boolean;
  /** True if the opponent has cracked the viewer's code. */
  theyCracked: boolean;
  /** Opponent's public state — their guesses with feedback, plus secret once gameOver. */
  opponent: Record<PlayerId, OpponentBoardView>;
  winner: PlayerId | null;
  isDraw: boolean;
}

// ------------------------- Config -------------------------

/** No lobby-time config. */
export type MastermindConfig = Record<string, never>;

// ------------------------- Moves -------------------------

const codeSchema = z
  .array(z.enum(COLORS))
  .length(CODE_LENGTH);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("setCode"),
    code: codeSchema,
  }),
  z.object({
    kind: z.literal("guess"),
    code: codeSchema,
  }),
]);
export type MastermindMove = z.infer<typeof moveSchema>;

// ------------------------- Pure helpers -------------------------

/**
 * Standard Mastermind scoring. Black pegs = exact positional matches.
 * White pegs = color matches in wrong positions, with each code peg and
 * guess peg contributing to at most one peg total (black pegs are counted
 * first, so exact positions are subtracted from the color-count bags
 * before counting whites).
 *
 * Example trace — secret=RRGB, guess=RGBY:
 *   position 0: R==R  → black=1
 *   position 1: R!=G  → remainder secret adds R, remainder guess adds G
 *   position 2: G!=B  → remainder secret adds G, remainder guess adds B
 *   position 3: B!=Y  → remainder secret adds B, remainder guess adds Y
 *   remainders: secret {R:1, G:1, B:1}, guess {G:1, B:1, Y:1}
 *   whites = min(R: 0,1)+min(G:1,1)+min(B:1,1)+min(Y:0,1) = 2
 *   → black=1, white=2 ✓
 */
export function scoreGuess(secret: Color[], guess: Color[]): GuessFeedback {
  let black = 0;
  const secretRem: Record<string, number> = {};
  const guessRem: Record<string, number> = {};
  for (let i = 0; i < CODE_LENGTH; i++) {
    const s = secret[i]!;
    const g = guess[i]!;
    if (s === g) {
      black++;
    } else {
      secretRem[s] = (secretRem[s] ?? 0) + 1;
      guessRem[g] = (guessRem[g] ?? 0) + 1;
    }
  }
  let white = 0;
  for (const color of Object.keys(guessRem)) {
    white += Math.min(guessRem[color] ?? 0, secretRem[color] ?? 0);
  }
  return { black, white };
}
