"use client";

/**
 * Client-side store for recently-visited tables. Persisted to localStorage so
 * the home page can surface a short "pick up where you left off" list. We keep
 * the most-recent 5 entries, dedupe on join code, and expire anything older
 * than 24 hours.
 */

const STORAGE_KEY = "bgo.recentTables";
const MAX_ENTRIES = 5;
const TTL_MS = 24 * 60 * 60 * 1000;

export interface RecentTable {
  tableId: string;
  joinCode: string;
  gameType: string;
  visitedAt: number;
}

function readRaw(): RecentTable[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is RecentTable =>
        !!e &&
        typeof e === "object" &&
        typeof (e as RecentTable).tableId === "string" &&
        typeof (e as RecentTable).joinCode === "string" &&
        typeof (e as RecentTable).gameType === "string" &&
        typeof (e as RecentTable).visitedAt === "number",
    );
  } catch {
    return [];
  }
}

function writeRaw(entries: RecentTable[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore quota errors
  }
}

function prune(entries: RecentTable[], now: number): RecentTable[] {
  return entries
    .filter((e) => now - e.visitedAt < TTL_MS)
    .sort((a, b) => b.visitedAt - a.visitedAt)
    .slice(0, MAX_ENTRIES);
}

/** Returns recent tables (fresh, sorted newest-first, capped). */
export function getRecentTables(now: number = Date.now()): RecentTable[] {
  const pruned = prune(readRaw(), now);
  writeRaw(pruned);
  return pruned;
}

/** Insert-or-update a recent table entry. Dedupes on join code. */
export function recordRecentTable(entry: {
  tableId: string;
  joinCode: string;
  gameType: string;
}): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const code = entry.joinCode.toUpperCase();
  const existing = readRaw().filter((e) => e.joinCode.toUpperCase() !== code);
  const next = prune(
    [{ ...entry, joinCode: code, visitedAt: now }, ...existing],
    now,
  );
  writeRaw(next);
}

/** Remove a recent table by join code (e.g. after a 404 probe). */
export function removeRecentTable(joinCode: string): void {
  if (typeof window === "undefined") return;
  const code = joinCode.toUpperCase();
  const next = readRaw().filter((e) => e.joinCode.toUpperCase() !== code);
  writeRaw(next);
}
