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
import { shuffle } from "@bgo/sdk";
import {
  DECK_FASCIST,
  DECK_LIBERAL,
  ELECTION_TRACKER_MAX,
  FASCIST_TRACK_WIN,
  HITLER_CHANCELLOR_DANGER,
  LIBERAL_TRACK_WIN,
  ROLE_COUNTS,
  SECRET_HITLER_TYPE,
  hitlerKnowsFascists,
  moveSchema,
  type SHConfig,
  type SHMove,
  type SHPolicy,
  type SHRole,
  type SHState,
  type SHTeam,
  type SHView,
  type SHVote,
  type SHVoteTally,
  type SHWinReason,
} from "./shared";

function fascistRoles(
  roles: Record<PlayerId, SHRole>,
  order: PlayerId[],
): PlayerId[] {
  return order.filter((id) => roles[id] === "fascist");
}

function hitlerId(roles: Record<PlayerId, SHRole>): PlayerId | null {
  for (const [id, role] of Object.entries(roles)) {
    if (role === "hitler") return id;
  }
  return null;
}

/**
 * Reshuffle discard into deck when fewer than 3 cards remain — the rulebook
 * requires the full 3-card draw at every legislative session.
 */
function ensureDeck(
  deck: SHPolicy[],
  discard: SHPolicy[],
  ctx: GameContext,
): { deck: SHPolicy[]; discard: SHPolicy[] } {
  if (deck.length >= 3) return { deck, discard };
  const merged = shuffle([...deck, ...discard], ctx.rng);
  return { deck: merged, discard: [] };
}

function advancePresident(state: SHState): number {
  return (state.presidentIdx + 1) % state.playerOrder.length;
}

/** Eligible chancellor set: not self, not immediate-previous President or Chancellor.
 *  Term limits only apply when more than 5 players remain (we don't implement execution,
 *  so the player count never shrinks below the initial count — but the rule is encoded
 *  for v2 in case execution arrives). */
function eligibleChancellors(state: SHState): PlayerId[] {
  const president = state.playerOrder[state.presidentIdx];
  const alive = state.playerOrder.length;
  const strict = alive > 5;
  return state.playerOrder.filter((id) => {
    if (id === president) return false;
    if (strict && id === state.lastChancellor) return false;
    if (strict && id === state.lastPresident) return false;
    return true;
  });
}

/** Start a fresh nomination round for the next president. */
function beginNomination(state: SHState): SHState {
  const blank: Record<PlayerId, null> = {};
  for (const id of state.playerOrder) blank[id] = null;
  return {
    ...state,
    phase: "nomination",
    president: null,
    chancellor: null,
    votes: blank,
    presidentHand: [],
    chancellorHand: [],
  };
}

/** Enact a policy on the correct track and check for a terminal state. */
function enactPolicy(
  state: SHState,
  policy: SHPolicy,
): { state: SHState; terminal: boolean } {
  const liberalTrack =
    policy === "liberal" ? state.liberalTrack + 1 : state.liberalTrack;
  const fascistTrack =
    policy === "fascist" ? state.fascistTrack + 1 : state.fascistTrack;
  const history = [...state.policyHistory, policy];
  let winner: SHTeam | null = null;
  let winReason: SHWinReason | null = null;
  if (liberalTrack >= LIBERAL_TRACK_WIN) {
    winner = "liberals";
    winReason = "liberalTrack";
  } else if (fascistTrack >= FASCIST_TRACK_WIN) {
    winner = "fascists";
    winReason = "fascistTrack";
  }
  const next: SHState = {
    ...state,
    liberalTrack,
    fascistTrack,
    policyHistory: history,
    winner,
    winReason,
    phase: winner ? "gameOver" : state.phase,
  };
  return { state: next, terminal: winner !== null };
}

export const secretHitlerServerModule: GameModule<
  SHState,
  SHMove,
  SHConfig,
  SHView
> = {
  type: SECRET_HITLER_TYPE,
  displayName: "Secret Hitler",
  description:
    "Elect Chancellors, enact policies, and find the Fascist hiding in plain sight.",
  category: "party",
  minPlayers: 5,
  maxPlayers: 10,

  defaultConfig(): SHConfig {
    return {};
  },

  validateConfig(cfg: unknown): SHConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: SHConfig,
    ctx: GameContext,
  ): SHState {
    const count = players.length;
    if (count < 5 || count > 10) {
      throw new Error(`Secret Hitler requires 5-10 players, got ${count}`);
    }

    const seating = shuffle(players, ctx.rng).map((p) => p.id);
    const { fascists: fascistCount } = ROLE_COUNTS[count]!;

    // Assign roles: pick Hitler first, then `fascistCount` other fascists.
    const rolePool = shuffle(seating, ctx.rng);
    const hitler = rolePool[0]!;
    const otherFascists = new Set(rolePool.slice(1, 1 + fascistCount));
    const roles: Record<PlayerId, SHRole> = {};
    for (const id of seating) {
      if (id === hitler) roles[id] = "hitler";
      else if (otherFascists.has(id)) roles[id] = "fascist";
      else roles[id] = "liberal";
    }

    // Build and shuffle the 17-card deck.
    const baseDeck: SHPolicy[] = [
      ...Array<SHPolicy>(DECK_LIBERAL).fill("liberal"),
      ...Array<SHPolicy>(DECK_FASCIST).fill("fascist"),
    ];
    const policyDeck = shuffle(baseDeck, ctx.rng);

    const blankVotes: Record<PlayerId, null> = {};
    for (const id of seating) blankVotes[id] = null;

    // Random starting president.
    const presidentIdx = Math.floor(ctx.rng() * seating.length);

    return {
      playerOrder: seating,
      roles,
      presidentIdx,
      president: null,
      chancellor: null,
      lastPresident: null,
      lastChancellor: null,
      phase: "nomination",
      votes: blankVotes,
      lastVotes: null,
      policyDeck,
      policyDiscard: [],
      presidentHand: [],
      chancellorHand: [],
      liberalTrack: 0,
      fascistTrack: 0,
      electionTracker: 0,
      policyHistory: [],
      winner: null,
      winReason: null,
    };
  },

  handleMove(
    state: SHState,
    move: SHMove,
    actor: PlayerId,
    ctx: GameContext,
  ): MoveResult<SHState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.playerOrder.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }
    const m = parsed.data;

    // ----------------- Nomination -----------------
    if (m.kind === "nominate") {
      if (state.phase !== "nomination") {
        return { ok: false, reason: "Not in the nomination phase" };
      }
      const president = state.playerOrder[state.presidentIdx]!;
      if (actor !== president) {
        return { ok: false, reason: "Only the president nominates" };
      }
      if (!state.playerOrder.includes(m.target)) {
        return { ok: false, reason: "Unknown nominee" };
      }
      if (m.target === president) {
        return { ok: false, reason: "You cannot nominate yourself" };
      }
      const allowed = eligibleChancellors(state);
      if (!allowed.includes(m.target)) {
        return {
          ok: false,
          reason: "That player isn't eligible as Chancellor this round",
        };
      }
      const blankVotes: Record<PlayerId, null> = {};
      for (const id of state.playerOrder) blankVotes[id] = null;
      return {
        ok: true,
        state: {
          ...state,
          president,
          chancellor: m.target,
          votes: blankVotes,
          phase: "vote",
        },
      };
    }

    // ----------------- Vote -----------------
    if (m.kind === "vote") {
      if (state.phase !== "vote") {
        return { ok: false, reason: "Not in the voting phase" };
      }
      if (state.votes[actor] != null) {
        return { ok: false, reason: "You already voted" };
      }
      const votes = { ...state.votes, [actor]: m.vote };
      const everyoneVoted = state.playerOrder.every((id) => votes[id] != null);
      if (!everyoneVoted) {
        return { ok: true, state: { ...state, votes } };
      }

      const jas = state.playerOrder.filter((id) => votes[id] === "ja").length;
      const neins = state.playerOrder.length - jas;
      const passed = jas > neins; // ties fail
      const finalVotes: Record<PlayerId, SHVote> = {};
      for (const id of state.playerOrder) finalVotes[id] = votes[id]!;

      if (!passed) {
        // Failed election — advance president, bump election tracker.
        const tracker = state.electionTracker + 1;
        let after: SHState = {
          ...state,
          votes,
          lastVotes: finalVotes,
        };
        if (tracker >= ELECTION_TRACKER_MAX) {
          // Chaos — top policy enacted blind, tracker + limits reset.
          const ensured = ensureDeck(state.policyDeck, state.policyDiscard, ctx);
          const deck = ensured.deck.slice();
          const top = deck.shift()!;
          const enacted = enactPolicy(
            {
              ...after,
              policyDeck: deck,
              policyDiscard: ensured.discard,
            },
            top,
          );
          if (enacted.terminal) {
            return { ok: true, state: enacted.state };
          }
          // Chaos resets both term limits AND election tracker.
          const rotated: SHState = {
            ...enacted.state,
            lastPresident: null,
            lastChancellor: null,
            electionTracker: 0,
            presidentIdx: advancePresident(state),
          };
          return { ok: true, state: beginNomination(rotated) };
        }
        // Normal failure — rotate to next president.
        after = {
          ...after,
          electionTracker: tracker,
          presidentIdx: advancePresident(state),
        };
        return { ok: true, state: beginNomination(after) };
      }

      // Election passed. Hitler-as-Chancellor instant-win check BEFORE drawing.
      if (
        state.roles[state.chancellor!] === "hitler" &&
        state.fascistTrack >= HITLER_CHANCELLOR_DANGER
      ) {
        return {
          ok: true,
          state: {
            ...state,
            votes,
            lastVotes: finalVotes,
            phase: "gameOver",
            winner: "fascists",
            winReason: "hitlerChancellor",
          },
        };
      }

      // Otherwise, go to the legislative session. President draws 3.
      const ensured = ensureDeck(state.policyDeck, state.policyDiscard, ctx);
      const deck = ensured.deck.slice();
      const hand: SHPolicy[] = [deck.shift()!, deck.shift()!, deck.shift()!];
      return {
        ok: true,
        state: {
          ...state,
          votes,
          lastVotes: finalVotes,
          policyDeck: deck,
          policyDiscard: ensured.discard,
          presidentHand: hand,
          phase: "presidentDiscard",
          electionTracker: 0,
        },
      };
    }

    // ----------------- President discards one policy -----------------
    if (m.kind === "presidentDiscard") {
      if (state.phase !== "presidentDiscard") {
        return { ok: false, reason: "Not in the president-discard phase" };
      }
      if (actor !== state.president) {
        return { ok: false, reason: "Only the president discards here" };
      }
      if (state.presidentHand.length !== 3) {
        return { ok: false, reason: "Presidential hand unavailable" };
      }
      if (m.index < 0 || m.index > 2) {
        return { ok: false, reason: "Invalid card index" };
      }
      const hand = state.presidentHand.slice();
      const [discarded] = hand.splice(m.index, 1);
      return {
        ok: true,
        state: {
          ...state,
          presidentHand: [],
          chancellorHand: hand,
          policyDiscard: [...state.policyDiscard, discarded!],
          phase: "chancellorEnact",
        },
      };
    }

    // ----------------- Chancellor enacts one policy -----------------
    if (m.kind === "chancellorEnact") {
      if (state.phase !== "chancellorEnact") {
        return { ok: false, reason: "Not in the chancellor-enact phase" };
      }
      if (actor !== state.chancellor) {
        return { ok: false, reason: "Only the chancellor enacts here" };
      }
      if (state.chancellorHand.length !== 2) {
        return { ok: false, reason: "Chancellor hand unavailable" };
      }
      if (m.index < 0 || m.index > 1) {
        return { ok: false, reason: "Invalid card index" };
      }
      const hand = state.chancellorHand.slice();
      const [enactedCard] = hand.splice(m.index, 1);
      const discardedCard = hand[0]!;
      const afterDiscard: SHState = {
        ...state,
        chancellorHand: [],
        policyDiscard: [...state.policyDiscard, discardedCard],
      };
      const result = enactPolicy(afterDiscard, enactedCard!);
      if (result.terminal) {
        return { ok: true, state: result.state };
      }
      // Commit term limits now that election actually produced an enacted
      // policy, rotate president, begin next nomination.
      const next: SHState = {
        ...result.state,
        lastPresident: state.president,
        lastChancellor: state.chancellor,
        presidentIdx: advancePresident(state),
      };
      return { ok: true, state: beginNomination(next) };
    }

    return { ok: false, reason: "Unknown move" };
  },

  view(state: SHState, viewer: Viewer): SHView {
    const isTerminal = state.phase === "gameOver";
    const isSpectator = viewer === "spectator";

    const viewerRole: SHRole | null = isSpectator
      ? null
      : state.roles[viewer] ?? null;

    // Role projection:
    //   - Fascists see every other fascist and Hitler.
    //   - Hitler sees fellow fascists ONLY in 5/6 player games.
    //   - Liberals see no roles.
    //   - Spectators see nothing mid-game; everything on gameOver.
    let knownFascists: Record<PlayerId, SHRole> | null = null;
    if (!isSpectator) {
      if (viewerRole === "fascist") {
        const out: Record<PlayerId, SHRole> = {};
        for (const id of state.playerOrder) {
          const r = state.roles[id];
          if (id !== viewer && (r === "fascist" || r === "hitler")) {
            out[id] = r;
          }
        }
        knownFascists = out;
      } else if (
        viewerRole === "hitler" &&
        hitlerKnowsFascists(state.playerOrder.length)
      ) {
        const out: Record<PlayerId, SHRole> = {};
        for (const id of state.playerOrder) {
          if (id !== viewer && state.roles[id] === "fascist") {
            out[id] = "fascist";
          }
        }
        knownFascists = out;
      }
    }

    // Vote projection: secret until every seat has voted. Once the vote is
    // complete, the full tally is public and stays visible through the rest
    // of the round (presidentDiscard/chancellorEnact/gameOver).
    const votesComplete =
      state.phase === "vote" &&
      state.playerOrder.every((id) => state.votes[id] != null);
    const voters = state.playerOrder.filter((id) => state.votes[id] != null);
    const revealed: Record<PlayerId, SHVote> | null = votesComplete
      ? Object.fromEntries(
          state.playerOrder.map((id) => [id, state.votes[id]!] as const),
        )
      : state.phase !== "vote" && state.lastVotes
        ? state.lastVotes
        : null;
    const voteTally: SHVoteTally = {
      voters,
      results: revealed,
    };

    // President's 3-card hand is visible ONLY to the sitting president during
    // the presidentDiscard phase.
    const presidentHand: SHPolicy[] | null =
      state.phase === "presidentDiscard" && viewer === state.president
        ? [...state.presidentHand]
        : null;

    // Chancellor's 2-card hand is visible ONLY to the sitting chancellor during
    // the chancellorEnact phase.
    const chancellorHand: SHPolicy[] | null =
      state.phase === "chancellorEnact" && viewer === state.chancellor
        ? [...state.chancellorHand]
        : null;

    // Eligible chancellors (public info — the rules are public).
    const eligible = eligibleChancellors(state);

    return {
      phase: state.phase,
      playerOrder: [...state.playerOrder],
      presidentIdx: state.presidentIdx,
      president: state.president,
      chancellor: state.chancellor,
      lastPresident: state.lastPresident,
      lastChancellor: state.lastChancellor,
      liberalTrack: state.liberalTrack,
      fascistTrack: state.fascistTrack,
      electionTracker: state.electionTracker,
      policyHistory: [...state.policyHistory],
      deckSize: state.policyDeck.length,
      discardSize: state.policyDiscard.length,
      voteTally,
      lastVotes: state.lastVotes,
      viewerRole,
      knownFascists,
      presidentHand,
      chancellorHand,
      eligibleChancellors: eligible,
      winner: state.winner,
      winReason: state.winReason,
      allRoles: isTerminal ? { ...state.roles } : null,
    };
  },

  phase(state: SHState): PhaseId {
    return state.phase;
  },

  currentActors(state: SHState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    if (state.phase === "nomination") {
      const p = state.playerOrder[state.presidentIdx];
      return p ? [p] : [];
    }
    if (state.phase === "vote") {
      return state.playerOrder.filter((id) => state.votes[id] == null);
    }
    if (state.phase === "presidentDiscard") {
      return state.president ? [state.president] : [];
    }
    if (state.phase === "chancellorEnact") {
      return state.chancellor ? [state.chancellor] : [];
    }
    return [];
  },

  isTerminal(state: SHState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: SHState): Outcome | null {
    if (!state.winner) return null;
    const losing: SHTeam =
      state.winner === "liberals" ? "fascists" : "liberals";
    return {
      kind: "team",
      winningTeam: state.winner,
      losingTeams: [losing],
    };
  },
};

// Exported helpers for tests / tooling.
export { fascistRoles, hitlerId };
