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
import { pickOne, shuffle } from "@bgo/sdk";
import locationsData from "./locations.json";
import {
  DEFAULT_ROUND_SECONDS,
  SPYFALL_TYPE,
  TIMER_KEY_ROUND,
  configSchema,
  moveSchema,
  type SpyfallAccusation,
  type SpyfallAccusationView,
  type SpyfallConfig,
  type SpyfallLocation,
  type SpyfallMove,
  type SpyfallState,
  type SpyfallView,
  type SpyfallViewer,
} from "./shared";

const LOCATIONS = locationsData as SpyfallLocation[];

function normalizeLocationName(s: string): string {
  return s.trim().toLowerCase();
}

function pendingVoters(state: SpyfallState): PlayerId[] {
  const acc = state.accusation;
  if (!acc) return [];
  return state.order.filter(
    (id) => id !== acc.target && !(id in acc.votes),
  );
}

function accusationView(
  state: SpyfallState,
  viewer: Viewer,
): SpyfallAccusationView | null {
  const acc = state.accusation;
  if (!acc) return null;
  const voters = Object.values(acc.votes);
  const approvals = voters.filter((v) => v).length;
  const rejections = voters.filter((v) => !v).length;
  const pending = pendingVoters(state);
  const viewerMustVote =
    viewer !== "spectator" && pending.includes(viewer);
  return {
    accuser: acc.accuser,
    target: acc.target,
    approvals,
    rejections,
    pending,
    viewerMustVote,
  };
}

function endGame(
  state: SpyfallState,
  winner: SpyfallState["winner"],
  reason: SpyfallState["winReason"],
): SpyfallState {
  return {
    ...state,
    phase: "gameOver",
    winner,
    winReason: reason,
    accusation: null,
  };
}

export const spyfallServerModule: GameModule<
  SpyfallState,
  SpyfallMove,
  SpyfallConfig,
  SpyfallView
> = {
  type: SPYFALL_TYPE,
  displayName: "Spyfall",
  description:
    "One of you is a spy in disguise. Trade one-question probes to unmask them — or, if you're the spy, deduce the location before you're caught.",
  minPlayers: 3,
  maxPlayers: 10,

  defaultConfig(): SpyfallConfig {
    return { roundSeconds: DEFAULT_ROUND_SECONDS };
  },

  validateConfig(cfg: unknown): SpyfallConfig {
    return configSchema.parse(cfg ?? {});
  },

  createInitialState(
    players: Player[],
    cfg: SpyfallConfig,
    ctx: GameContext,
  ): SpyfallState {
    if (players.length < 3) {
      throw new Error("Spyfall needs at least 3 players");
    }
    const location = pickOne(LOCATIONS, ctx.rng);
    const shuffledPlayers = shuffle(players, ctx.rng);
    const spy = shuffledPlayers[0]!;
    const nonSpies = shuffledPlayers.slice(1);

    // Assign non-spies to location roles, no duplicates until roles run out.
    const roleDeck = shuffle(location.roles, ctx.rng);
    const roles: Record<PlayerId, string> = {};
    nonSpies.forEach((p, i) => {
      roles[p.id] = roleDeck[i % roleDeck.length]!;
    });

    const order = shuffle(players, ctx.rng).map((p) => p.id);
    const locationPool = LOCATIONS.map((l) => l.name).sort((a, b) =>
      a.localeCompare(b),
    );

    const endsAt = ctx.now + cfg.roundSeconds * 1000;
    ctx.scheduleTimer(TIMER_KEY_ROUND, endsAt);

    return {
      location: location.name,
      locationPool,
      roles,
      spyId: spy.id,
      order,
      phase: "playing",
      startedAt: ctx.now,
      endsAt,
      accusation: null,
      spyGuess: null,
      winner: null,
      winReason: null,
    };
  },

  handleMove(
    state: SpyfallState,
    move: SpyfallMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<SpyfallState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.order.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const m = parsed.data;
    const isSpy = actor === state.spyId;

    // --- spyGuess: only the spy, anytime ---
    if (m.kind === "spyGuess") {
      if (!isSpy) {
        return { ok: false, reason: "Only the spy can guess the location" };
      }
      const guess = normalizeLocationName(m.location);
      const match = state.locationPool.find(
        (l) => normalizeLocationName(l) === guess,
      );
      if (!match) {
        return { ok: false, reason: "That isn't one of the listed locations" };
      }
      ctx.cancelTimer(TIMER_KEY_ROUND);
      const correct = normalizeLocationName(state.location) === guess;
      const base = { ...state, spyGuess: match };
      return {
        ok: true,
        state: endGame(
          base,
          correct ? "spy" : "nonSpies",
          correct ? "spyGuessedRight" : "spyGuessedWrong",
        ),
      };
    }

    // --- accuse: opens a vote ---
    if (m.kind === "accuse") {
      if (state.phase !== "playing") {
        return { ok: false, reason: "An accusation is already in progress" };
      }
      if (isSpy) {
        return { ok: false, reason: "The spy cannot accuse" };
      }
      if (m.target === actor) {
        return { ok: false, reason: "You cannot accuse yourself" };
      }
      if (!state.order.includes(m.target)) {
        return { ok: false, reason: "Unknown target" };
      }
      // Accuser votes yes implicitly.
      const accusation: SpyfallAccusation = {
        accuser: actor,
        target: m.target,
        votes: { [actor]: true },
      };
      return {
        ok: true,
        state: { ...state, phase: "voting", accusation },
      };
    }

    // --- cancelAccusation: accuser only ---
    if (m.kind === "cancelAccusation") {
      const acc = state.accusation;
      if (!acc || state.phase !== "voting") {
        return { ok: false, reason: "No accusation to cancel" };
      }
      if (acc.accuser !== actor) {
        return { ok: false, reason: "Only the accuser can cancel" };
      }
      return {
        ok: true,
        state: { ...state, phase: "playing", accusation: null },
      };
    }

    // --- vote: non-target, non-already-voted ---
    if (m.kind === "vote") {
      const acc = state.accusation;
      if (!acc || state.phase !== "voting") {
        return { ok: false, reason: "No vote in progress" };
      }
      if (actor === acc.target) {
        return { ok: false, reason: "The accused doesn't vote" };
      }
      if (actor in acc.votes) {
        return { ok: false, reason: "You already voted" };
      }
      const nextVotes = { ...acc.votes, [actor]: m.approve };
      const nextAcc: SpyfallAccusation = { ...acc, votes: nextVotes };
      const nextState: SpyfallState = { ...state, accusation: nextAcc };

      // If any rejection, cancel the accusation and return to play.
      if (!m.approve) {
        return {
          ok: true,
          state: { ...nextState, phase: "playing", accusation: null },
        };
      }

      // All required voters must approve. Required = everyone except target.
      const requiredVoters = state.order.filter((id) => id !== acc.target);
      const allApproved = requiredVoters.every(
        (id) => nextVotes[id] === true,
      );
      if (allApproved) {
        ctx.cancelTimer(TIMER_KEY_ROUND);
        const caught = acc.target === state.spyId;
        return {
          ok: true,
          state: endGame(
            nextState,
            caught ? "nonSpies" : "spy",
            caught ? "accusedSpy" : "accusedNonSpy",
          ),
        };
      }
      return { ok: true, state: nextState };
    }

    return { ok: false, reason: "Unknown move" };
  },

  onTimer(
    state: SpyfallState,
    key: string,
    _ctx: GameContext,
  ): MoveResult<SpyfallState> {
    if (key !== TIMER_KEY_ROUND) {
      return { ok: false, reason: `Unknown timer ${key}` };
    }
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game already over" };
    }
    // Spy survives the clock → spy wins.
    return { ok: true, state: endGame(state, "spy", "timeUp") };
  },

  view(state: SpyfallState, viewer: Viewer): SpyfallView {
    const isTerminal = state.phase === "gameOver";
    const isSpectator = viewer === "spectator";
    const isSpy = !isSpectator && viewer === state.spyId;

    const viewerInfo: SpyfallViewer = {
      isSpy,
      role:
        isTerminal
          ? !isSpectator
            ? state.roles[viewer] ?? null
            : null
          : isSpy || isSpectator
            ? null
            : state.roles[viewer] ?? null,
      location:
        isTerminal
          ? state.location
          : isSpy || isSpectator
            ? null
            : state.location,
    };

    return {
      phase: state.phase,
      endsAt: state.endsAt,
      order: [...state.order],
      locationPool: [...state.locationPool],
      accusation: accusationView(state, viewer),
      viewer: viewerInfo,
      spyId: isTerminal ? state.spyId : isSpy ? state.spyId : null,
      location: isTerminal ? state.location : null,
      allRoles: isTerminal ? { ...state.roles } : null,
      winner: state.winner,
      winReason: state.winReason,
      spyGuess: state.spyGuess,
    };
  },

  phase(state: SpyfallState): PhaseId {
    return state.phase;
  },

  currentActors(state: SpyfallState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    if (state.phase === "voting") return pendingVoters(state);
    // In "playing", anyone can take an action (accuse or spyGuess); signal all.
    return [...state.order];
  },

  isTerminal(state: SpyfallState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: SpyfallState): Outcome | null {
    if (!state.winner) return null;
    const winners: PlayerId[] = [];
    const losers: PlayerId[] = [];
    if (state.winner === "spy") {
      winners.push(state.spyId);
      for (const id of state.order) if (id !== state.spyId) losers.push(id);
    } else {
      for (const id of state.order) {
        if (id === state.spyId) losers.push(id);
        else winners.push(id);
      }
    }
    return { kind: "solo", winners, losers };
  },
};
