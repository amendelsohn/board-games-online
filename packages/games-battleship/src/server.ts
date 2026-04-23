import type {
  GameContext,
  GameModule,
  MoveResult,
  Outcome,
  PhaseId,
  Player,
  PlayerId,
  Viewer,
} from "@bgo/sdk";
import {
  BATTLESHIP_TYPE,
  BOARD_SIZE,
  SHIP_LENGTHS,
  SHIP_TYPES,
  cellIndex,
  moveSchema,
  shipCells,
  type BattleshipConfig,
  type BattleshipMove,
  type BattleshipState,
  type BattleshipView,
  type Board,
  type LastShot,
  type Placement,
  type PlayerSideView,
  type ShipRecord,
  type ShipType,
  type Shots,
  type ShotMark,
} from "./shared";

const BOARD_CELLS = BOARD_SIZE * BOARD_SIZE;

function emptyBoard(): Board {
  return new Array(BOARD_CELLS).fill(null) as (ShipType | null)[];
}

function emptyShots(): Shots {
  return new Array(BOARD_CELLS).fill(null) as ShotMark[];
}

function opponentOf(state: BattleshipState, actor: PlayerId): PlayerId {
  return state.players[0] === actor ? state.players[1] : state.players[0];
}

/**
 * Validate and lay out a fleet. Returns the materialized board + ship records,
 * or an error string. Rules:
 *  - exactly 5 placements, one per ship type with the correct length
 *  - every cell on-grid
 *  - no overlaps between ships
 */
function layFleet(
  placements: Placement[],
): { ok: true; board: Board; ships: ShipRecord[] } | { ok: false; reason: string } {
  if (placements.length !== SHIP_TYPES.length) {
    return { ok: false, reason: `Expected ${SHIP_TYPES.length} ship placements` };
  }
  const seen = new Set<ShipType>();
  const board = emptyBoard() as (ShipType | null)[];
  const ships: ShipRecord[] = [];

  for (const p of placements) {
    if (seen.has(p.ship)) {
      return { ok: false, reason: `Duplicate placement for ${p.ship}` };
    }
    seen.add(p.ship);
    const length = SHIP_LENGTHS[p.ship];
    const cells = shipCells(p.row, p.col, length, p.orient);
    if (!cells) {
      return { ok: false, reason: `${p.ship} is off-grid` };
    }
    for (const { row, col } of cells) {
      const i = cellIndex(row, col);
      if (board[i] !== null) {
        return { ok: false, reason: `${p.ship} overlaps another ship` };
      }
      board[i] = p.ship;
    }
    ships.push({
      ship: p.ship,
      row: p.row,
      col: p.col,
      orient: p.orient,
      length,
      hits: 0,
      sunk: false,
    });
  }

  for (const required of SHIP_TYPES) {
    if (!seen.has(required)) {
      return { ok: false, reason: `Missing ${required}` };
    }
  }

  return { ok: true, board, ships };
}

function sunkCount(ships: ShipRecord[]): number {
  return ships.filter((s) => s.sunk).length;
}

export const battleshipServerModule: GameModule<
  BattleshipState,
  BattleshipMove,
  BattleshipConfig,
  BattleshipView
> = {
  type: BATTLESHIP_TYPE,
  displayName: "Battleship",
  description:
    "Hide your fleet, hunt theirs — simultaneous placement, alternating salvos.",
  category: "strategy",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): BattleshipConfig {
    return {};
  },

  validateConfig(cfg: unknown): BattleshipConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: BattleshipConfig,
    ctx: GameContext,
  ): BattleshipState {
    if (players.length !== 2) {
      throw new Error(
        `battleship requires exactly 2 players, got ${players.length}`,
      );
    }
    const [a, b] = players as [Player, Player];
    // Randomize the firing order up front; it only matters once both fleets are placed.
    const firstFires = ctx.rng() < 0.5 ? a.id : b.id;
    return {
      players: [a.id, b.id],
      boards: { [a.id]: emptyBoard(), [b.id]: emptyBoard() },
      ships: { [a.id]: [], [b.id]: [] },
      shots: { [a.id]: emptyShots(), [b.id]: emptyShots() },
      placed: { [a.id]: false, [b.id]: false },
      phase: "placing",
      current: firstFires,
      winner: null,
      lastShot: null,
    };
  },

  handleMove(
    state: BattleshipState,
    move: BattleshipMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<BattleshipState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.players.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const m = parsed.data;

    if (m.kind === "place") {
      if (state.phase !== "placing") {
        return { ok: false, reason: "Placement already locked in" };
      }
      if (state.placed[actor]) {
        return { ok: false, reason: "You already placed your fleet" };
      }
      const laid = layFleet(m.placements);
      if (!laid.ok) return { ok: false, reason: laid.reason };

      const nextBoards = { ...state.boards, [actor]: laid.board };
      const nextShips = { ...state.ships, [actor]: laid.ships };
      const nextPlaced = { ...state.placed, [actor]: true };
      const bothPlaced = state.players.every((id) => nextPlaced[id]);

      return {
        ok: true,
        state: {
          ...state,
          boards: nextBoards,
          ships: nextShips,
          placed: nextPlaced,
          phase: bothPlaced ? "firing" : "placing",
        },
      };
    }

    // m.kind === "fire"
    if (state.phase !== "firing") {
      return { ok: false, reason: "Finish placing first" };
    }
    if (state.current !== actor) {
      return { ok: false, reason: "Not your turn" };
    }
    const opponent = opponentOf(state, actor);
    const idx = cellIndex(m.row, m.col);
    const myShots = state.shots[actor];
    if (!myShots) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (myShots[idx] !== null) {
      return { ok: false, reason: "You already fired on that cell" };
    }

    const oppBoard = state.boards[opponent];
    const oppShips = state.ships[opponent];
    if (!oppBoard || !oppShips) {
      return { ok: false, reason: "Opponent missing" };
    }
    const hitShip = oppBoard[idx];

    const nextMyShots = myShots.slice() as ShotMark[];
    let sunkShip: ShipType | null = null;
    let nextOppShips = oppShips;

    if (hitShip) {
      nextMyShots[idx] = "hit";
      nextOppShips = oppShips.map((s) => {
        if (s.ship !== hitShip) return s;
        const hits = s.hits + 1;
        const sunk = hits >= s.length;
        if (sunk) sunkShip = s.ship;
        return { ...s, hits, sunk };
      });
    } else {
      nextMyShots[idx] = "miss";
    }

    const allSunk = nextOppShips.every((s) => s.sunk);
    const nextShots = { ...state.shots, [actor]: nextMyShots };
    const nextShips = { ...state.ships, [opponent]: nextOppShips };
    const lastShot: LastShot = {
      by: actor,
      row: m.row,
      col: m.col,
      result: hitShip ? "hit" : "miss",
      sunk: sunkShip,
    };

    if (allSunk) {
      return {
        ok: true,
        state: {
          ...state,
          shots: nextShots,
          ships: nextShips,
          lastShot,
          phase: "gameOver",
          winner: actor,
          // Leave `current` as the winner for display.
          current: actor,
        },
      };
    }

    return {
      ok: true,
      state: {
        ...state,
        shots: nextShots,
        ships: nextShips,
        lastShot,
        // Classic rules: always alternate after a shot, even on a hit.
        current: opponent,
      },
    };
  },

  view(state: BattleshipState, viewer: Viewer): BattleshipView {
    const isTerminal = state.phase === "gameOver";
    const isSpectator = viewer === "spectator";
    const viewerIsPlayer = !isSpectator && state.players.includes(viewer);

    const sides: Record<PlayerId, PlayerSideView> = {};
    for (const pid of state.players) {
      const ownBoard = state.boards[pid] ?? (emptyBoard() as Board);
      const ownShips = state.ships[pid] ?? [];
      // Incoming = the shots the OPPONENT has fired onto this side.
      const opp = pid === state.players[0] ? state.players[1] : state.players[0];
      const incoming = (state.shots[opp] ?? emptyShots()) as Shots;

      const revealToViewer =
        isTerminal || (!isSpectator && viewer === pid);

      sides[pid] = {
        board: revealToViewer ? ([...ownBoard] as Board) : null,
        incoming: [...incoming] as Shots,
        ships: revealToViewer
          ? ownShips.map((s) => ({ ...s }))
          : null,
        sunkCount: sunkCount(ownShips),
      };
    }

    const viewerMustPlace =
      viewerIsPlayer &&
      state.phase === "placing" &&
      !state.placed[viewer];

    return {
      phase: state.phase,
      players: [...state.players] as [PlayerId, PlayerId],
      placed: { ...state.placed },
      current: state.current,
      winner: state.winner,
      lastShot: state.lastShot ? { ...state.lastShot } : null,
      sides,
      viewerMustPlace,
      viewerIsPlayer,
    };
  },

  phase(state: BattleshipState): PhaseId {
    return state.phase;
  },

  currentActors(state: BattleshipState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    if (state.phase === "placing") {
      return state.players.filter((id) => !state.placed[id]);
    }
    return [state.current];
  },

  isTerminal(state: BattleshipState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: BattleshipState): Outcome | null {
    if (!state.winner) return null;
    const losers = state.players.filter((id) => id !== state.winner);
    return { kind: "solo", winners: [state.winner], losers };
  },
};
