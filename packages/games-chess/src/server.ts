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
  CHESS_TYPE,
  anyLegalMove,
  applyCandidateToCells,
  buildInitialBoard,
  hasInsufficientMaterial,
  homeRow,
  idx,
  isInCheck,
  legalMovesFrom,
  moveSchema,
  opponent,
  pieceColor,
  pieceKind,
  positionKey,
  sameSquare,
  type CastlingRights,
  type ChessCandidate,
  type ChessConfig,
  type ChessMove,
  type ChessState,
  type ChessView,
  type Piece,
  type Square,
} from "./shared";

function opponentOf(state: ChessState, actor: PlayerId): PlayerId {
  const ids = Object.keys(state.colors);
  return ids.find((id) => id !== actor) ?? actor;
}

function updatedCastlingRights(
  rights: CastlingRights,
  cand: ChessCandidate,
  movedPiece: Piece,
): CastlingRights {
  const next = { ...rights };
  const kind = pieceKind(movedPiece);
  const color = pieceColor(movedPiece);

  if (kind === "k") {
    if (color === "w") {
      next.wk = false;
      next.wq = false;
    } else {
      next.bk = false;
      next.bq = false;
    }
  }
  if (kind === "r") {
    const hr = homeRow(color);
    if (cand.from.row === hr && cand.from.col === 0) {
      if (color === "w") next.wq = false;
      else next.bq = false;
    } else if (cand.from.row === hr && cand.from.col === 7) {
      if (color === "w") next.wk = false;
      else next.bk = false;
    }
  }

  // Captures on a rook's starting square cancel the corresponding right.
  if (cand.to.row === 0 && cand.to.col === 0) next.bq = false;
  if (cand.to.row === 0 && cand.to.col === 7) next.bk = false;
  if (cand.to.row === 7 && cand.to.col === 0) next.wq = false;
  if (cand.to.row === 7 && cand.to.col === 7) next.wk = false;

  return next;
}

function computeEnPassantTarget(
  cand: ChessCandidate,
  movedPiece: Piece,
): Square | null {
  if (pieceKind(movedPiece) !== "p") return null;
  const dr = cand.to.row - cand.from.row;
  if (Math.abs(dr) !== 2) return null;
  return { row: (cand.from.row + cand.to.row) / 2, col: cand.from.col };
}

export const chessServerModule: GameModule<
  ChessState,
  ChessMove,
  ChessConfig,
  ChessView
> = {
  type: CHESS_TYPE,
  displayName: "Chess",
  description: "Classic 8×8 — checkmate your opponent's king.",
  category: "classic",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): ChessConfig {
    return {};
  },

  validateConfig(cfg: unknown): ChessConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: ChessConfig,
    ctx: GameContext,
  ): ChessState {
    if (players.length !== 2) {
      throw new Error(`chess requires exactly 2 players, got ${players.length}`);
    }
    const whiteFirst = ctx.rng() < 0.5;
    const [a, b] = players;
    const white = whiteFirst ? a! : b!;
    const black = whiteFirst ? b! : a!;
    const cells = buildInitialBoard();
    const state: ChessState = {
      cells,
      colors: { [white.id]: "w", [black.id]: "b" },
      current: white.id,
      castling: { wk: true, wq: true, bk: true, bq: true },
      enPassant: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      positionHistory: {},
      winner: null,
      draw: null,
      lastMove: null,
      inCheck: false,
    };
    const key = positionKey(state);
    state.positionHistory = { [key]: 1 };
    return state;
  },

  handleMove(
    state: ChessState,
    move: ChessMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<ChessState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.winner || state.draw) return { ok: false, reason: "Game is over" };
    if (state.current !== actor) return { ok: false, reason: "Not your turn" };
    const myColor = state.colors[actor];
    if (!myColor) return { ok: false, reason: "You are not in this match" };

    const { from, to, promotion } = parsed.data;
    const piece = state.cells[idx(from.row, from.col)];
    if (!piece) return { ok: false, reason: "No piece to move" };
    if (pieceColor(piece) !== myColor) {
      return { ok: false, reason: "That piece is not yours" };
    }

    const legal = legalMovesFrom(state, from);
    // If the move is a promotion, match on promotion kind too; otherwise any
    // same-target candidate (there will be only one non-promo candidate per
    // destination).
    const candidates = legal.filter(
      (c) => sameSquare(c.to, to) && (c.promotion ?? undefined) === promotion,
    );
    let chosen: ChessCandidate | undefined = candidates[0];

    // Allow "missing promotion" on a promotion move by defaulting to queen —
    // a courtesy for clients that haven't asked which piece yet. If a
    // promotion was sent but no candidate matches (e.g. non-promo square),
    // fall through to the illegal-move path.
    if (!chosen && !promotion) {
      chosen = legal.find(
        (c) => sameSquare(c.to, to) && c.promotion === "q",
      );
    }

    if (!chosen) {
      if (state.inCheck) return { ok: false, reason: "You must address check" };
      return { ok: false, reason: "Illegal move" };
    }

    const nextCells = applyCandidateToCells(state.cells, chosen);
    const nextCastling = updatedCastlingRights(state.castling, chosen, piece);
    const nextEp = computeEnPassantTarget(chosen, piece);

    const isPawn = pieceKind(piece) === "p";
    const nextHalfmove =
      isPawn || chosen.isCapture ? 0 : state.halfmoveClock + 1;
    const nextFullmove =
      myColor === "b" ? state.fullmoveNumber + 1 : state.fullmoveNumber;

    const opp = opponentOf(state, actor);
    const oppColor = opponent(myColor);

    const oppInCheck = isInCheck(nextCells, oppColor);
    const nextForOpp = {
      cells: nextCells,
      castling: nextCastling,
      enPassant: nextEp,
    };
    const oppHasMove = anyLegalMove(nextForOpp, oppColor);

    let winner: PlayerId | null = null;
    let draw: ChessState["draw"] = null;
    if (!oppHasMove) {
      if (oppInCheck) winner = actor;
      else draw = "stalemate";
    } else if (hasInsufficientMaterial(nextCells)) {
      draw = "insufficientMaterial";
    } else if (nextHalfmove >= 100) {
      draw = "fiftyMove";
    }

    // Repetition bookkeeping — count AFTER the move, from opponent's POV.
    const tentative: ChessState = {
      cells: nextCells,
      colors: state.colors,
      current: opp,
      castling: nextCastling,
      enPassant: nextEp,
      halfmoveClock: nextHalfmove,
      fullmoveNumber: nextFullmove,
      positionHistory: state.positionHistory,
      winner,
      draw,
      lastMove: { from, to },
      inCheck: oppInCheck,
    };
    const key = positionKey(tentative);
    const nextHistory =
      isPawn || chosen.isCapture || chosen.castle || chosen.promotion
        ? { [key]: 1 }
        : { ...state.positionHistory, [key]: (state.positionHistory[key] ?? 0) + 1 };
    if (!winner && !draw && (nextHistory[key] ?? 0) >= 3) {
      draw = "threefold";
    }

    return {
      ok: true,
      state: {
        cells: nextCells,
        colors: state.colors,
        current: winner || draw ? actor : opp,
        castling: nextCastling,
        enPassant: nextEp,
        halfmoveClock: nextHalfmove,
        fullmoveNumber: nextFullmove,
        positionHistory: nextHistory,
        winner,
        draw,
        lastMove: { from, to },
        inCheck: winner || draw ? false : oppInCheck,
      },
    };
  },

  view(state: ChessState, _viewer: Viewer): ChessView {
    return {
      cells: state.cells.slice(),
      colors: { ...state.colors },
      current: state.current,
      castling: { ...state.castling },
      enPassant: state.enPassant ? { ...state.enPassant } : null,
      winner: state.winner,
      draw: state.draw,
      lastMove: state.lastMove
        ? { from: { ...state.lastMove.from }, to: { ...state.lastMove.to } }
        : null,
      inCheck: state.inCheck,
    };
  },

  phase(state: ChessState): PhaseId {
    if (state.winner || state.draw) return "gameOver";
    return "play";
  },

  currentActors(state: ChessState): PlayerId[] {
    if (state.winner || state.draw) return [];
    return [state.current];
  },

  isTerminal(state: ChessState): boolean {
    return state.winner !== null || state.draw !== null;
  },

  outcome(state: ChessState): Outcome | null {
    if (state.winner) {
      const losers = Object.keys(state.colors).filter(
        (id) => id !== state.winner,
      );
      return { kind: "solo", winners: [state.winner], losers };
    }
    if (state.draw) return { kind: "draw" };
    return null;
  },
};

