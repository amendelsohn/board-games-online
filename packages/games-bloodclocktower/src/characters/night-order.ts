import type { Character } from "../shared";
import { ALL_CHARACTERS_BY_ID } from "./all";

/**
 * Single entry the Storyteller's Night Order panel renders. Each one
 * corresponds to either a special pre-step ("Minion info" / "Demon
 * info" on first night) or a seat whose character has a wake order.
 */
export interface NightStep {
  /** Stable id for React keys + ST move targeting. */
  id: string;
  /** Sort key — order within tonight. */
  order: number;
  /** Display label (character name, or "Minion info" / "Demon info"). */
  label: string;
  /**
   * Either a single seat, multiple seats (Minion info wakes all minions),
   * or null (a label-only step the ST handles outside seat-targeted UI).
   * Seat IDs are PlayerIds.
   */
  seatIds: string[];
  /**
   * The originating character, when the step is one character's
   * scheduled wake. Null for the abstract Minion/Demon info pre-steps.
   */
  character: Character | null;
  kind: "character" | "minion-info" | "demon-info";
}

/**
 * Compute the canonical night-order step list for tonight, given the
 * grimoire (mapping seats → character ids) and which night this is.
 *
 * For first night the list always begins with the abstract Minion-info
 * and Demon-info steps (when there are minions / a demon at the table)
 * so the ST has a clear ordered checklist.
 *
 * Order numbers come from each Character.firstNight / otherNights field.
 * Characters without an order for tonight are omitted.
 */
export function tonightOrder(
  grimoire: Record<string, { characterId: string | null }>,
  isFirstNight: boolean,
  characterLookup: (id: string) => Character | undefined = (id) =>
    ALL_CHARACTERS_BY_ID[id],
): NightStep[] {
  const steps: NightStep[] = [];

  // Group seats by character so multi-character abilities (Minion info)
  // can be collapsed into a single step.
  const seatsByCharacter = new Map<string, string[]>();
  for (const [seatId, seat] of Object.entries(grimoire)) {
    if (!seat.characterId) continue;
    const list = seatsByCharacter.get(seat.characterId) ?? [];
    list.push(seatId);
    seatsByCharacter.set(seat.characterId, list);
  }

  if (isFirstNight) {
    // Pre-step: wake all minions to learn each other + the Demon.
    const minionSeats: string[] = [];
    let demonSeats: string[] = [];
    for (const [characterId, seats] of seatsByCharacter) {
      const c = characterLookup(characterId);
      if (!c) continue;
      if (c.team === "minion") minionSeats.push(...seats);
      if (c.team === "demon") demonSeats = [...demonSeats, ...seats];
    }
    if (minionSeats.length > 0) {
      steps.push({
        id: "step:minion-info",
        order: -2,
        label: "Minion info",
        seatIds: minionSeats,
        character: null,
        kind: "minion-info",
      });
    }
    if (demonSeats.length > 0) {
      steps.push({
        id: "step:demon-info",
        order: -1,
        label: "Demon info & bluffs",
        seatIds: demonSeats,
        character: null,
        kind: "demon-info",
      });
    }
  }

  // Per-character scheduled wakes.
  for (const [characterId, seats] of seatsByCharacter) {
    const c = characterLookup(characterId);
    if (!c) continue;
    const order = isFirstNight ? c.firstNight : c.otherNights;
    if (order === null || order === undefined) continue;
    for (const seatId of seats) {
      steps.push({
        id: `step:${seatId}:${characterId}`,
        order,
        label: c.name,
        seatIds: [seatId],
        character: c,
        kind: "character",
      });
    }
  }

  steps.sort((a, b) => a.order - b.order);
  return steps;
}
