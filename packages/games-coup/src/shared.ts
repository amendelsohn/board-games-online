import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const COUP_TYPE = "coup";

export type Card =
  | "duke"
  | "assassin"
  | "captain"
  | "ambassador"
  | "contessa";

export const ALL_CARDS: readonly Card[] = [
  "duke",
  "assassin",
  "captain",
  "ambassador",
  "contessa",
];

export type ActionType =
  | "income"
  | "foreignAid"
  | "tax"
  | "steal"
  | "assassinate"
  | "exchange"
  | "coup";

export type Phase =
  | "action"
  | "respond"
  | "blockRespond"
  | "reveal"
  | "exchange"
  | "gameOver";

export type RevealReason =
  | "lostChallenge"
  | "assassinated"
  | "couped";

export type ResponseKind = "allow" | "block" | "challenge";

/** One card held by a player. Revealed cards count as "lost influence". */
export interface HandCard {
  card: Card;
  revealed: boolean;
}

/** Who's in the middle of acting, what they claimed, and who they targeted. */
export interface PendingAction {
  actor: PlayerId;
  actionType: ActionType;
  target: PlayerId | null;
  /** The card the actor implicitly claimed by choosing this action, if any. */
  claim: Card | null;
}

export interface PendingBlock {
  blocker: PlayerId;
  blockAs: Card;
}

export interface ForcedReveal {
  player: PlayerId;
  reason: RevealReason;
  /**
   * A snapshot of the state machine to resume when this reveal resolves.
   * "resolveAction" - reveal is the final step, then we advance to next turn.
   * "resumeAction"  - reveal happened on the actor/challenger; the underlying
   *                   action should still fire after the reveal is complete.
   * "noResume"      - side-effect reveal (e.g. assassination target); no resume.
   */
  resume: "resolveAction" | "fireAction" | "abortAction" | "noResume";
}

/** A short line shown in the history strip. */
export interface LogEntry {
  id: number;
  text: string;
}

export interface CoupState {
  playerOrder: PlayerId[];
  hands: Record<PlayerId, HandCard[]>;
  coins: Record<PlayerId, number>;
  deck: Card[];
  current: PlayerId;
  phase: Phase;
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  /** Players still owing a response to the current action or block. */
  respondersRemaining: PlayerId[];
  forcedReveal: ForcedReveal | null;
  /** Set when we have drawn cards for an Ambassador exchange. */
  exchangeDraw: Card[] | null;
  log: LogEntry[];
  nextLogId: number;
  winner: PlayerId | null;
}

// ------------------------- View -------------------------

export interface OpponentHandView {
  /** Revealed (flipped) cards — visible to all. */
  revealed: Card[];
  /** How many face-down (still-influential) cards remain. */
  hiddenCount: number;
}

export interface CoupView {
  phase: Phase;
  playerOrder: PlayerId[];
  current: PlayerId;
  coins: Record<PlayerId, number>;
  /** Number of cards still in the deck — contents hidden from everyone. */
  deckCount: number;
  /** The viewer's own hand (cards + revealed flag). Null for spectators. */
  myHand: HandCard[] | null;
  /** Everyone else's hands as public projections. */
  opponents: Record<PlayerId, OpponentHandView>;
  pendingAction: PendingAction | null;
  pendingBlock: PendingBlock | null;
  respondersRemaining: PlayerId[];
  forcedReveal: ForcedReveal | null;
  /** The two face-down cards drawn for an Ambassador exchange — shown only to the acting player. */
  exchangeDraw: Card[] | null;
  log: LogEntry[];
  winner: PlayerId | null;
  /** At game over, every hand is revealed. */
  finalHands: Record<PlayerId, HandCard[]> | null;
}

// ------------------------- Config -------------------------

export type CoupConfig = Record<string, never>;

// ------------------------- Moves -------------------------

export const actionTypeSchema = z.enum([
  "income",
  "foreignAid",
  "tax",
  "steal",
  "assassinate",
  "exchange",
  "coup",
]);

export const cardSchema = z.enum([
  "duke",
  "assassin",
  "captain",
  "ambassador",
  "contessa",
]);

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("action"),
    actionType: actionTypeSchema,
    target: z.string().min(1).optional(),
  }),
  z.object({
    kind: z.literal("respond"),
    response: z.enum(["allow", "block", "challenge"]),
    blockAs: cardSchema.optional(),
  }),
  z.object({
    kind: z.literal("revealInfluence"),
    cardIndex: z.number().int().min(0).max(1),
  }),
  z.object({
    kind: z.literal("exchangeSelect"),
    /** Cards the acting player chooses to keep from (hand + drawn). */
    keep: z.array(cardSchema).min(0).max(2),
  }),
]);
export type CoupMove = z.infer<typeof moveSchema>;

// ------------------------- Rule helpers -------------------------

/** The card an action implicitly claims (if any). Null for income/aid/coup. */
export function claimFor(action: ActionType): Card | null {
  switch (action) {
    case "tax":
      return "duke";
    case "steal":
      return "captain";
    case "assassinate":
      return "assassin";
    case "exchange":
      return "ambassador";
    case "income":
    case "foreignAid":
    case "coup":
      return null;
  }
}

/** Cards that legally block the given action, if any. */
export function blockersFor(action: ActionType): Card[] {
  switch (action) {
    case "foreignAid":
      return ["duke"];
    case "steal":
      return ["captain", "ambassador"];
    case "assassinate":
      return ["contessa"];
    default:
      return [];
  }
}

export function actionIsBlockable(action: ActionType): boolean {
  return blockersFor(action).length > 0;
}

export function actionIsChallengeable(action: ActionType): boolean {
  return claimFor(action) !== null;
}

export function actionNeedsTarget(action: ActionType): boolean {
  return action === "steal" || action === "assassinate" || action === "coup";
}
