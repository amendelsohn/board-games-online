import type { Character } from "../shared";
import { TROUBLE_BREWING_BY_ID } from "./trouble-brewing";
import { BAD_MOON_RISING_BY_ID } from "./bad-moon-rising";
import { SECTS_AND_VIOLETS_BY_ID } from "./sects-and-violets";

/**
 * Unified id → character lookup spanning Trouble Brewing, Bad Moon
 * Rising, and Sects & Violets. Used by helpers (night order,
 * client UI) that need to resolve any character regardless of which
 * edition the active script came from.
 *
 * Custom scripts (Phase 3) will be allowed to inline their own
 * Character objects which take precedence over this map at lookup
 * time — this map is only for the canonical pre-shipped editions.
 */
export const ALL_CHARACTERS_BY_ID: Readonly<Record<string, Character>> = {
  ...TROUBLE_BREWING_BY_ID,
  ...BAD_MOON_RISING_BY_ID,
  ...SECTS_AND_VIOLETS_BY_ID,
};

export function lookupCharacter(id: string): Character | undefined {
  return ALL_CHARACTERS_BY_ID[id];
}
