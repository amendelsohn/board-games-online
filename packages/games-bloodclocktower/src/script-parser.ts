import { ALL_CHARACTERS_BY_ID } from "./characters/all";
import type { CustomScript } from "./shared";

/**
 * Parse a canonical BotC script JSON (the format produced by the
 * official Pandemonium Institute Script Tool and consumed by every
 * BotC tool: townsquare, pocket-grimoire, clocktower.online, etc.).
 *
 * Accepts an array of:
 *   - string ids (referencing a known character): "washerwoman"
 *   - object entries with at least { id }: { id: "washerwoman" }
 *   - a meta entry: { id: "_meta", name: "...", author: "..." }
 *
 * Returns the extracted CustomScript on success, or { error } with a
 * human-readable message on failure (unknown character ids included).
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
  const unknownIds: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const entry = parsed[i];
    let id: string | null = null;
    if (typeof entry === "string") {
      id = entry;
    } else if (entry && typeof entry === "object" && "id" in entry) {
      id = String((entry as { id: unknown }).id);
      if (id === "_meta") {
        const meta = entry as { id: string; name?: unknown; author?: unknown };
        if (typeof meta.name === "string" && meta.name.trim()) {
          scriptName = meta.name.trim().slice(0, 100);
        }
        continue;
      }
    } else {
      return {
        error: `Entry at index ${i} is not a string or object with an id field.`,
      };
    }

    if (!id) continue;
    // Normalize: accept both "fortune_teller" and "fortuneteller" forms by
    // collapsing underscores. Canonical IDs we ship use the no-underscore
    // form (matching bra1n/townsquare).
    const normalized = id.toLowerCase().replace(/_/g, "");
    if (!ALL_CHARACTERS_BY_ID[normalized]) {
      unknownIds.push(id);
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
        `v1 supports characters from Trouble Brewing, Bad Moon Rising, and Sects & Violets.`,
    };
  }

  if (ids.length < 5) {
    return {
      error: `Need at least 5 characters in the script (found ${ids.length}).`,
    };
  }

  return { script: { name: scriptName, characterIds: ids } };
}
