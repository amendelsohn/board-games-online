import { z } from "zod";
import type { PlayerId } from "@bgo/sdk";

export const QUORIDOR_TYPE = "quoridor";

export const BOARD_SIZE = 9;
export const WALL_GRID_SIZE = BOARD_SIZE - 1; // 8
export const WALLS_PER_PLAYER = 10;

export type WallKind = "h" | "v";

export interface Wall {
  kind: WallKind;
  /** 0..WALL_GRID_SIZE-1 */
  row: number;
  /** 0..WALL_GRID_SIZE-1 */
  col: number;
}

export interface Pos {
  row: number;
  col: number;
}

/** [P1, P2]. P1 starts at top row, moves down to row 8. P2 starts at bottom row. */
export interface QuoridorState {
  players: readonly [PlayerId, PlayerId];
  pos: Record<PlayerId, Pos>;
  wallsLeft: Record<PlayerId, number>;
  walls: Wall[];
  current: PlayerId;
  winner: PlayerId | null;
  /** Move index, mostly for animation continuity. */
  moveNumber: number;
  lastMove:
    | { kind: "move"; by: PlayerId; from: Pos; to: Pos }
    | { kind: "wall"; by: PlayerId; wall: Wall }
    | null;
}

export interface QuoridorView {
  players: [PlayerId, PlayerId];
  pos: Record<PlayerId, Pos>;
  wallsLeft: Record<PlayerId, number>;
  walls: Wall[];
  current: PlayerId;
  winner: PlayerId | null;
  moveNumber: number;
  lastMove: QuoridorState["lastMove"];
  /** Precomputed on the server for the current actor — saves client work. */
  legalMoves: Pos[];
}

export type QuoridorConfig = Record<string, never>;

export const moveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("move"),
    to: z.object({
      row: z.number().int().min(0).max(BOARD_SIZE - 1),
      col: z.number().int().min(0).max(BOARD_SIZE - 1),
    }),
  }),
  z.object({
    kind: z.literal("wall"),
    wall: z.object({
      kind: z.enum(["h", "v"]),
      row: z.number().int().min(0).max(WALL_GRID_SIZE - 1),
      col: z.number().int().min(0).max(WALL_GRID_SIZE - 1),
    }),
  }),
]);
export type QuoridorMove = z.infer<typeof moveSchema>;

// ------------------------- Pure logic -------------------------

export function goalRow(players: readonly [PlayerId, PlayerId], pid: PlayerId): number {
  return pid === players[0] ? BOARD_SIZE - 1 : 0;
}

export function inBounds(p: Pos): boolean {
  return (
    p.row >= 0 &&
    p.row < BOARD_SIZE &&
    p.col >= 0 &&
    p.col < BOARD_SIZE
  );
}

export function posEq(a: Pos, b: Pos): boolean {
  return a.row === b.row && a.col === b.col;
}

/** Does a wall block the step from `from` to `to` where they are orthogonal neighbors? */
export function stepBlockedByWall(from: Pos, to: Pos, walls: Wall[]): boolean {
  const dr = to.row - from.row;
  const dc = to.col - from.col;
  if (Math.abs(dr) + Math.abs(dc) !== 1) return true;

  if (dr !== 0) {
    const hr = Math.min(from.row, to.row);
    for (const w of walls) {
      if (w.kind !== "h") continue;
      if (w.row !== hr) continue;
      if (w.col === from.col || w.col === from.col - 1) return true;
    }
    return false;
  }

  // horizontal step
  const vc = Math.min(from.col, to.col);
  for (const w of walls) {
    if (w.kind !== "v") continue;
    if (w.col !== vc) continue;
    if (w.row === from.row || w.row === from.row - 1) return true;
  }
  return false;
}

const DIRS: Array<[number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/**
 * Enumerate legal destinations for a pawn, honoring wall blockage, board
 * edges, jump-over-opponent, and diagonal side-steps when a straight jump is
 * blocked.
 */
export function legalPawnDestinations(
  from: Pos,
  opponent: Pos,
  walls: Wall[],
): Pos[] {
  const out: Pos[] = [];
  for (const [dr, dc] of DIRS) {
    const next: Pos = { row: from.row + dr, col: from.col + dc };
    if (!inBounds(next)) continue;
    if (stepBlockedByWall(from, next, walls)) continue;

    if (posEq(next, opponent)) {
      // Jump / side-step
      const jump: Pos = { row: next.row + dr, col: next.col + dc };
      const straightOk =
        inBounds(jump) && !stepBlockedByWall(next, jump, walls);
      if (straightOk) {
        out.push(jump);
      } else {
        // Side-step diagonals: two perpendicular neighbors of opponent, not
        // blocked and not the from-cell.
        for (const [pdr, pdc] of DIRS) {
          if (pdr === dr && pdc === dc) continue;
          if (pdr === -dr && pdc === -dc) continue;
          const diag: Pos = {
            row: next.row + pdr,
            col: next.col + pdc,
          };
          if (!inBounds(diag)) continue;
          if (stepBlockedByWall(next, diag, walls)) continue;
          if (posEq(diag, from)) continue;
          out.push(diag);
        }
      }
    } else {
      out.push(next);
    }
  }
  // De-dup (diagonals from two blocked-straight branches could overlap).
  return dedup(out);
}

function dedup(ps: Pos[]): Pos[] {
  const seen = new Set<string>();
  const r: Pos[] = [];
  for (const p of ps) {
    const k = `${p.row},${p.col}`;
    if (seen.has(k)) continue;
    seen.add(k);
    r.push(p);
  }
  return r;
}

/**
 * BFS: can the pawn at `start` reach any cell in `goalRow`, honoring walls?
 * Opponent pawn is ignored (can always jump / pass through).
 */
export function canReachGoal(
  start: Pos,
  goalRow: number,
  walls: Wall[],
): boolean {
  const visited = new Set<string>();
  const key = (p: Pos) => `${p.row},${p.col}`;
  const queue: Pos[] = [start];
  visited.add(key(start));
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.row === goalRow) return true;
    for (const [dr, dc] of DIRS) {
      const nxt: Pos = { row: cur.row + dr, col: cur.col + dc };
      if (!inBounds(nxt)) continue;
      if (stepBlockedByWall(cur, nxt, walls)) continue;
      const k = key(nxt);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(nxt);
    }
  }
  return false;
}

/** Returns true if `candidate` conflicts with any wall in `walls`. */
export function wallConflicts(candidate: Wall, walls: Wall[]): boolean {
  for (const w of walls) {
    if (w.kind === candidate.kind) {
      if (w.row === candidate.row && w.col === candidate.col) return true;
      if (candidate.kind === "h") {
        if (w.row === candidate.row && Math.abs(w.col - candidate.col) === 1)
          return true;
      } else {
        if (w.col === candidate.col && Math.abs(w.row - candidate.row) === 1)
          return true;
      }
    } else {
      // Different kinds — they cross only if they share the same (row, col) "peg".
      if (w.row === candidate.row && w.col === candidate.col) return true;
    }
  }
  return false;
}
