import { ALL_CHARACTERS_BY_ID } from "./characters/all";
import {
  type CustomScript,
  type InlineCharacter,
  inlineCharacterSchema,
} from "./shared";

/**
 * Parse a canonical BotC script JSON (the format produced by the
 * official Pandemonium Institute Script Tool and consumed by every
 * BotC tool: townsquare, pocket-grimoire, clocktower.online, etc.).
 *
 * Accepts an array of:
 *   - string ids (referencing a known character): "washerwoman"
 *   - object entries that just reference a known id: { id: "washerwoman" }
 *   - a meta entry: { id: "_meta", name: "...", author: "..." }
 *   - inline character definitions for homebrew chars not in our pool:
 *     { id, name, team, ability, firstNight?, otherNights?, reminders?, setup? }
 *
 * Inline definitions take precedence: if an id appears both as an
 * inline def and in our shipped pool, the inline wins (custom script
 * can shadow built-ins). Object entries that look like inline defs
 * but fail validation are reported with a descriptive error.
 *
 * The `_meta.name` is used as the script's display name; if absent,
 * a sensible default is used.
 */
export function parseScriptJson(
  raw: string,
): { script: CustomScript } | { error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Couldn't parse JSON: ${msg}` };
  }
  if (!Array.isArray(parsed)) {
    return { error: "Expected a JSON array of script entries." };
  }

  let scriptName = "Custom Script";
  const ids: string[] = [];
  const inline: InlineCharacter[] = [];
  const unknownIds: string[] = [];

  // Normalize: accept both "fortune_teller" and "fortuneteller" forms by
  // collapsing underscores. Canonical IDs we ship use the no-underscore
  // form (matching bra1n/townsquare).
  const normalizeId = (id: string) => id.toLowerCase().replace(/_/g, "");

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];

    // Bare string id: must reference a known character (no inline form).
    if (typeof entry === "string") {
      const normalized = normalizeId(entry);
      if (!ALL_CHARACTERS_BY_ID[normalized]) {
        unknownIds.push(entry);
        continue;
      }
      ids.push(normalized);
      continue;
    }

    if (!entry || typeof entry !== "object" || !("id" in entry)) {
      return {
        error: `Entry at index ${i} is not a string or object with an id field.`,
      };
    }
    const obj = entry as Record<string, unknown>;
    const rawId = String(obj.id);

    if (rawId === "_meta") {
      if (typeof obj.name === "string" && obj.name.trim()) {
        scriptName = obj.name.trim().slice(0, 100);
      }
      continue;
    }

    const normalized = normalizeId(rawId);

    // Inline definition: has at least name + team + ability beyond the id.
    // Otherwise it's just an id reference.
    const hasInlineFields =
      typeof obj.name === "string" ||
      typeof obj.team === "string" ||
      typeof obj.ability === "string";

    if (hasInlineFields) {
      // Build a candidate object normalized to our schema (name `otherNight`
      // → `otherNights` since the canonical roles.json uses singular).
      const candidate: Record<string, unknown> = {
        ...obj,
        id: normalized,
      };
      if ("otherNight" in obj && !("otherNights" in obj)) {
        candidate.otherNights = obj.otherNight;
      }
      const result = inlineCharacterSchema.safeParse(candidate);
      if (!result.success) {
        return {
          error: `Inline character "${rawId}" is malformed: ${result.error.errors[0]?.message ?? "validation failed"}`,
        };
      }
      inline.push(result.data);
      ids.push(normalized);
      continue;
    }

    // No inline fields → treat as an id reference.
    if (!ALL_CHARACTERS_BY_ID[normalized]) {
      unknownIds.push(rawId);
      continue;
    }
    ids.push(normalized);
  }

  if (unknownIds.length > 0) {
    const sample = unknownIds.slice(0, 5).join(", ");
    const more = unknownIds.length > 5 ? `, +${unknownIds.length - 5} more` : "";
    return {
      error:
        `${unknownIds.length} character${
          unknownIds.length === 1 ? "" : "s"
        } not in our library: ${sample}${more}. ` +
        `Either reference a character we ship (Trouble Brewing, Bad Moon Rising, ` +
        `Sects & Violets, Fabled), or include an inline definition with name, team, ability.`,
    };
  }

  if (ids.length < 5) {
    return {
      error: `Need at least 5 characters in the script (found ${ids.length}).`,
    };
  }

  return {
    script: {
      name: scriptName,
      characterIds: ids,
      ...(inline.length > 0 ? { inlineCharacters: inline } : {}),
    },
  };
}
