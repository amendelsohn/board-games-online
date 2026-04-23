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
  CODE_LENGTH,
  MASTERMIND_TYPE,
  MAX_GUESSES,
  moveSchema,
  scoreGuess,
  type Color,
  type MastermindConfig,
  type MastermindMove,
  type MastermindState,
  type MastermindView,
  type OpponentBoardView,
} from "./shared";

function opponentOf(state: MastermindState, actor: PlayerId): PlayerId | null {
  const [a, b] = state.players;
  if (actor === a) return b;
  if (actor === b) return a;
  return null;
}

function playerDone(state: MastermindState, p: PlayerId): boolean {
  return state.cracked[p] === true || (state.guesses[p]?.length ?? 0) >= MAX_GUESSES;
}

/**
 * Terminal rule:
 *   - Both players are done (cracked or out of guesses).
 * Outcome:
 *   - Only one cracked → that player wins.
 *   - Both cracked → whoever used fewer guesses wins; tie → draw.
 *   - Neither cracked → draw.
 */
function finalize(state: MastermindState): MastermindState {
  const [a, b] = state.players;
  const aDone = playerDone(state, a);
  const bDone = playerDone(state, b);
  if (!aDone || !bDone) return state;

  const aCracked = state.cracked[a] === true;
  const bCracked = state.cracked[b] === true;
  const aTries = state.guesses[a]?.length ?? 0;
  const bTries = state.guesses[b]?.length ?? 0;

  let winner: PlayerId | null = null;
  let isDraw = false;
  if (aCracked && !bCracked) winner = a;
  else if (bCracked && !aCracked) winner = b;
  else if (aCracked && bCracked) {
    if (aTries < bTries) winner = a;
    else if (bTries < aTries) winner = b;
    else isDraw = true;
  } else {
    isDraw = true;
  }

  return {
    ...state,
    phase: "gameOver",
    winner,
    isDraw,
  };
}

function buildOpponentView(
  state: MastermindState,
  target: PlayerId,
  reveal: boolean,
): OpponentBoardView {
  return {
    guesses: (state.guesses[target] ?? []).map((g) => ({
      code: [...g.code],
      feedback: { ...g.feedback },
    })),
    codeSet: state.secrets[target] !== null,
    cracked: state.cracked[target] === true,
    secret: reveal ? state.secrets[target] ? [...state.secrets[target]!] : null : null,
  };
}

export const mastermindServerModule: GameModule<
  MastermindState,
  MastermindMove,
  MastermindConfig,
  MastermindView
> = {
  type: MASTERMIND_TYPE,
  displayName: "Mastermind",
  description:
    "Crack the secret code in ten guesses — or set one for your opponent.",
  category: "strategy",
  minPlayers: 2,
  maxPlayers: 2,

  defaultConfig(): MastermindConfig {
    return {};
  },

  validateConfig(cfg: unknown): MastermindConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: MastermindConfig,
    _ctx: GameContext,
  ): MastermindState {
    if (players.length !== 2) {
      throw new Error(`mastermind requires exactly 2 players, got ${players.length}`);
    }
    const [a, b] = players;
    const seat: [PlayerId, PlayerId] = [a!.id, b!.id];
    return {
      phase: "setting",
      players: seat,
      secrets: { [seat[0]]: null, [seat[1]]: null },
      guesses: { [seat[0]]: [], [seat[1]]: [] },
      cracked: { [seat[0]]: false, [seat[1]]: false },
      startedGuessingAt: null,
      winner: null,
      isDraw: false,
    };
  },

  handleMove(
    state: MastermindState,
    move: MastermindMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<MastermindState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") return { ok: false, reason: "Game is over" };
    const opp = opponentOf(state, actor);
    if (opp === null) return { ok: false, reason: "You are not in this match" };

    const m = parsed.data;

    if (m.kind === "setCode") {
      if (state.phase !== "setting") {
        return { ok: false, reason: "Codes are already locked" };
      }
      if (state.secrets[actor] !== null) {
        return { ok: false, reason: "You already set your code" };
      }
      const code = m.code as Color[];
      if (code.length !== CODE_LENGTH) {
        return { ok: false, reason: "Code must be 4 pegs" };
      }
      const nextSecrets = { ...state.secrets, [actor]: [...code] };
      const bothSet =
        nextSecrets[state.players[0]] !== null &&
        nextSecrets[state.players[1]] !== null;
      return {
        ok: true,
        state: {
          ...state,
          secrets: nextSecrets,
          phase: bothSet ? "guessing" : "setting",
          startedGuessingAt: bothSet ? ctx.now : null,
        },
      };
    }

    // guess
    if (state.phase !== "guessing") {
      return { ok: false, reason: "Not time to guess yet" };
    }
    if (playerDone(state, actor)) {
      return { ok: false, reason: "You have no guesses left" };
    }
    const secret = state.secrets[opp];
    if (!secret) {
      return { ok: false, reason: "Opponent has not set a code" };
    }
    const guess = m.code as Color[];
    if (guess.length !== CODE_LENGTH) {
      return { ok: false, reason: "Guess must be 4 pegs" };
    }
    const feedback = scoreGuess(secret, guess);
    const cracked = feedback.black === CODE_LENGTH;
    const nextGuesses = {
      ...state.guesses,
      [actor]: [
        ...(state.guesses[actor] ?? []),
        { code: [...guess], feedback },
      ],
    };
    const nextCracked = { ...state.cracked, [actor]: cracked };
    const next: MastermindState = {
      ...state,
      guesses: nextGuesses,
      cracked: nextCracked,
    };
    return { ok: true, state: finalize(next) };
  },

  view(state: MastermindState, viewer: Viewer): MastermindView {
    const isOver = state.phase === "gameOver";
    const isSpectator = viewer === "spectator";
    const [a, b] = state.players;

    const mySecret =
      !isSpectator && (viewer === a || viewer === b)
        ? state.secrets[viewer] ? [...state.secrets[viewer]!] : null
        : null;

    const myGuesses =
      !isSpectator && (viewer === a || viewer === b)
        ? (state.guesses[viewer] ?? []).map((g) => ({
            code: [...g.code],
            feedback: { ...g.feedback },
          }))
        : [];

    const iCracked =
      !isSpectator && (viewer === a || viewer === b)
        ? state.cracked[viewer] === true
        : false;

    const theyCracked = (() => {
      if (isSpectator) return false;
      const opp = opponentOf(state, viewer);
      return opp ? state.cracked[opp] === true : false;
    })();

    // For each player, reveal secret only on gameOver.
    // A player sees their opponent's public guesses + (on reveal) secret.
    // Spectators see both players' public guesses, and both secrets on reveal.
    const opponent: Record<PlayerId, OpponentBoardView> = {};
    if (isSpectator) {
      opponent[a] = buildOpponentView(state, a, isOver);
      opponent[b] = buildOpponentView(state, b, isOver);
    } else {
      const opp = opponentOf(state, viewer);
      if (opp !== null) {
        opponent[opp] = buildOpponentView(state, opp, isOver);
      }
    }

    return {
      phase: state.phase,
      players: [...state.players],
      mySecret,
      myGuesses,
      iCracked,
      theyCracked,
      opponent,
      winner: state.winner,
      isDraw: state.isDraw,
    };
  },

  phase(state: MastermindState): PhaseId {
    return state.phase;
  },

  currentActors(state: MastermindState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    if (state.phase === "setting") {
      return state.players.filter((p) => state.secrets[p] === null);
    }
    return state.players.filter((p) => !playerDone(state, p));
  },

  isTerminal(state: MastermindState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: MastermindState): Outcome | null {
    if (state.phase !== "gameOver") return null;
    if (state.isDraw) return { kind: "draw" };
    if (state.winner) {
      const losers = state.players.filter((p) => p !== state.winner);
      return { kind: "solo", winners: [state.winner], losers };
    }
    return null;
  },
};
