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
  AVALON_TYPE,
  MAX_REJECTIONS,
  QUEST_SIZES,
  SPY_COUNT,
  failsNeeded,
  moveSchema,
  type AvalonConfig,
  type AvalonMove,
  type AvalonQuestResult,
  type AvalonRole,
  type AvalonState,
  type AvalonTeam,
  type AvalonView,
  type AvalonVoteTally,
} from "./shared";

function spiesIn(roles: Record<PlayerId, AvalonRole>, order: PlayerId[]): PlayerId[] {
  return order.filter((id) => roles[id] === "spy");
}

function merlinIn(roles: Record<PlayerId, AvalonRole>): PlayerId | null {
  for (const [id, role] of Object.entries(roles)) {
    if (role === "merlin") return id;
  }
  return null;
}

/** Count quest results so far. */
function questTally(results: Array<AvalonQuestResult | null>): {
  success: number;
  failure: number;
} {
  let success = 0;
  let failure = 0;
  for (const r of results) {
    if (r === "success") success++;
    else if (r === "failure") failure++;
  }
  return { success, failure };
}

/** After a quest resolves (either side), advance to the next quest's proposal phase. */
function beginNextProposal(state: AvalonState, nextQuestIdx: number): AvalonState {
  const blankVotes: Record<PlayerId, null> = {};
  for (const id of state.playerOrder) blankVotes[id] = null;
  return {
    ...state,
    questIdx: nextQuestIdx,
    proposalNumber: 1,
    proposedTeam: null,
    votes: blankVotes,
    questVotes: {},
    phase: "proposal",
    leaderIdx: (state.leaderIdx + 1) % state.playerOrder.length,
  };
}

/** After a proposal is rejected — either by vote or auto-rotated — reset to next leader. */
function rotateAfterRejection(
  state: AvalonState,
  nextProposalNumber: number,
): AvalonState {
  const blankVotes: Record<PlayerId, null> = {};
  for (const id of state.playerOrder) blankVotes[id] = null;
  return {
    ...state,
    proposalNumber: nextProposalNumber,
    proposedTeam: null,
    votes: blankVotes,
    phase: "proposal",
    leaderIdx: (state.leaderIdx + 1) % state.playerOrder.length,
  };
}

export const avalonServerModule: GameModule<
  AvalonState,
  AvalonMove,
  AvalonConfig,
  AvalonView
> = {
  type: AVALON_TYPE,
  displayName: "Avalon",
  description:
    "Loyal servants vs. traitors — run five quests, and don't let the spies out Merlin.",
  category: "party",
  minPlayers: 5,
  maxPlayers: 10,

  defaultConfig(): AvalonConfig {
    return {};
  },

  validateConfig(cfg: unknown): AvalonConfig {
    if (cfg === undefined || cfg === null) return {};
    if (typeof cfg !== "object") throw new Error("Invalid config");
    return {};
  },

  createInitialState(
    players: Player[],
    _cfg: AvalonConfig,
    ctx: GameContext,
  ): AvalonState {
    const count = players.length;
    if (count < 5 || count > 10) {
      throw new Error(`Avalon requires 5-10 players, got ${count}`);
    }

    const seating = shuffle(players, ctx.rng).map((p) => p.id);

    // Assign roles: pick spy slots out of the seating uniformly at random.
    const spyCount = SPY_COUNT[count]!;
    const shuffledForRoles = shuffle(seating, ctx.rng);
    const spies = new Set(shuffledForRoles.slice(0, spyCount));
    const loyals = shuffledForRoles.slice(spyCount);
    const merlin = loyals[Math.floor(ctx.rng() * loyals.length)]!;

    const roles: Record<PlayerId, AvalonRole> = {};
    for (const id of seating) {
      if (spies.has(id)) roles[id] = "spy";
      else if (id === merlin) roles[id] = "merlin";
      else roles[id] = "loyal";
    }

    const blankVotes: Record<PlayerId, null> = {};
    for (const id of seating) blankVotes[id] = null;

    // Random starting leader.
    const leaderIdx = Math.floor(ctx.rng() * seating.length);

    return {
      playerOrder: seating,
      roles,
      leaderIdx,
      questIdx: 0,
      questResults: [null, null, null, null, null],
      proposalNumber: 1,
      proposedTeam: null,
      votes: blankVotes,
      questVotes: {},
      phase: "proposal",
      winner: null,
      winReason: null,
      merlinGuess: null,
    };
  },

  handleMove(
    state: AvalonState,
    move: AvalonMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<AvalonState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    if (!state.playerOrder.includes(actor)) {
      return { ok: false, reason: "You are not in this match" };
    }

    const m = parsed.data;
    const count = state.playerOrder.length;
    const leader = state.playerOrder[state.leaderIdx]!;

    // -------- proposeTeam: leader only, in proposal phase --------
    if (m.kind === "proposeTeam") {
      if (state.phase !== "proposal") {
        return { ok: false, reason: "Not in the proposal phase" };
      }
      if (actor !== leader) {
        return { ok: false, reason: "Only the leader proposes a team" };
      }
      const size = QUEST_SIZES[count]![state.questIdx]!;
      const unique = Array.from(new Set(m.team));
      if (unique.length !== m.team.length) {
        return { ok: false, reason: "Team can't list the same player twice" };
      }
      if (m.team.length !== size) {
        return {
          ok: false,
          reason: `Team must be exactly ${size} players`,
        };
      }
      for (const id of m.team) {
        if (!state.playerOrder.includes(id)) {
          return { ok: false, reason: "Unknown player in team" };
        }
      }
      const blankVotes: Record<PlayerId, null> = {};
      for (const id of state.playerOrder) blankVotes[id] = null;
      return {
        ok: true,
        state: {
          ...state,
          proposedTeam: [...m.team],
          votes: blankVotes,
          phase: "vote",
        },
      };
    }

    // -------- vote: any seated player, during vote phase, once --------
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

      // Tally: majority approve sends the quest; tie rejects.
      const approves = state.playerOrder.filter((id) => votes[id] === "approve").length;
      const rejects = count - approves;
      const approved = approves > rejects;

      if (!approved) {
        // Proposal rejected — leader rotates. 5 consecutive rejections → spies win.
        if (state.proposalNumber >= MAX_REJECTIONS) {
          return {
            ok: true,
            state: {
              ...state,
              votes,
              phase: "gameOver",
              winner: "spies",
              winReason: "hammerReject",
            },
          };
        }
        // Keep the freshly-voted tally around momentarily so the client can
        // reveal the vote before we reset; commit votes=final so `view()` shows
        // them, then caller will see a fresh proposal via the next proposeTeam.
        const rolled = rotateAfterRejection(
          { ...state, votes },
          state.proposalNumber + 1,
        );
        return { ok: true, state: rolled };
      }

      // Proposal approved → begin the quest.
      const questVotes: Record<PlayerId, null> = {};
      for (const id of state.proposedTeam ?? []) questVotes[id] = null;
      return {
        ok: true,
        state: {
          ...state,
          votes,
          phase: "quest",
          questVotes,
        },
      };
    }

    // -------- questVote: proposed-team members only --------
    if (m.kind === "questVote") {
      if (state.phase !== "quest") {
        return { ok: false, reason: "Not in the quest phase" };
      }
      if (!(actor in state.questVotes)) {
        return { ok: false, reason: "You are not on this quest team" };
      }
      if (state.questVotes[actor] != null) {
        return { ok: false, reason: "You already played your quest card" };
      }
      // Loyal (and Merlin) must play success. Spies may play either.
      const role = state.roles[actor];
      if (m.vote === "fail" && role !== "spy") {
        return { ok: false, reason: "Loyal servants must play success" };
      }

      const questVotes = { ...state.questVotes, [actor]: m.vote };
      const allPlayed = Object.values(questVotes).every((v) => v != null);
      if (!allPlayed) {
        return { ok: true, state: { ...state, questVotes } };
      }

      // Resolve the quest.
      const fails = Object.values(questVotes).filter((v) => v === "fail").length;
      const needed = failsNeeded(count, state.questIdx);
      const result: AvalonQuestResult = fails >= needed ? "failure" : "success";
      const questResults = state.questResults.slice();
      questResults[state.questIdx] = result;

      const tally = questTally(questResults);

      // Spy wins outright when 3 quests have failed.
      if (tally.failure >= 3) {
        return {
          ok: true,
          state: {
            ...state,
            questVotes,
            questResults,
            phase: "gameOver",
            winner: "spies",
            winReason: "spyQuests",
          },
        };
      }

      // Loyal wins 3 quests → spies get one Merlin guess.
      if (tally.success >= 3) {
        return {
          ok: true,
          state: {
            ...state,
            questVotes,
            questResults,
            phase: "merlinGuess",
          },
        };
      }

      // Otherwise, advance to the next quest's first proposal.
      return {
        ok: true,
        state: beginNextProposal(
          { ...state, questVotes, questResults },
          state.questIdx + 1,
        ),
      };
    }

    // -------- accuseMerlin: first spy in seating order, during merlinGuess --------
    if (m.kind === "accuseMerlin") {
      if (state.phase !== "merlinGuess") {
        return { ok: false, reason: "No Merlin guess in progress" };
      }
      const designatedSpy = spiesIn(state.roles, state.playerOrder)[0];
      if (!designatedSpy) {
        // Should never happen; treat as crash-safe loyal win.
        return {
          ok: true,
          state: {
            ...state,
            phase: "gameOver",
            winner: "loyal",
            winReason: "merlinSaved",
          },
        };
      }
      if (actor !== designatedSpy) {
        return { ok: false, reason: "Only the designated spy guesses Merlin" };
      }
      if (!state.playerOrder.includes(m.target)) {
        return { ok: false, reason: "Unknown target" };
      }
      // Can't accuse a spy — must pick a loyal/merlin player.
      if (state.roles[m.target] === "spy") {
        return { ok: false, reason: "You must pick a non-spy" };
      }
      const caught = state.roles[m.target] === "merlin";
      return {
        ok: true,
        state: {
          ...state,
          merlinGuess: m.target,
          phase: "gameOver",
          winner: caught ? "spies" : "loyal",
          winReason: caught ? "merlinCaught" : "merlinSaved",
        },
      };
    }

    return { ok: false, reason: "Unknown move" };
  },

  view(state: AvalonState, viewer: Viewer): AvalonView {
    const count = state.playerOrder.length;
    const leader = state.playerOrder[state.leaderIdx]!;
    const isTerminal = state.phase === "gameOver";
    const isSpectator = viewer === "spectator";

    const viewerRole: AvalonRole | null = isSpectator
      ? null
      : state.roles[viewer] ?? null;

    // Role projection:
    //   - Spies see the other spies (not Merlin).
    //   - Merlin sees the spies (not other loyals).
    //   - Loyal non-Merlin sees nothing.
    //   - Spectators see nothing while play is live.
    //   - On game over everyone sees everyone.
    let knownSpies: PlayerId[] = [];
    if (!isSpectator) {
      if (viewerRole === "spy") {
        knownSpies = spiesIn(state.roles, state.playerOrder).filter(
          (id) => id !== viewer,
        );
      } else if (viewerRole === "merlin") {
        knownSpies = spiesIn(state.roles, state.playerOrder);
      }
    }

    // Votes: keep them secret until every seated player has voted, then reveal.
    const votesComplete =
      state.phase !== "proposal" &&
      state.phase !== "gameOver" &&
      state.playerOrder.every((id) => state.votes[id] != null);
    // Also reveal votes while displaying the quest phase (so players can see
    // who approved the mission they're about to resolve) and terminal state.
    const revealVotes =
      isTerminal || state.phase === "quest" || votesComplete;
    const voters = state.playerOrder.filter((id) => state.votes[id] != null);
    const voteTally: AvalonVoteTally = {
      voters,
      results: revealVotes
        ? Object.fromEntries(
            state.playerOrder
              .filter((id) => state.votes[id] != null)
              .map((id) => [id, state.votes[id]!] as const),
          )
        : null,
    };

    // Quest submissions: only expose the COUNT of players who have played their
    // card on the active quest — never who voted what.
    const questSubmissions = Object.values(state.questVotes).filter(
      (v) => v != null,
    ).length;

    const currentQuestSize = QUEST_SIZES[count]![state.questIdx]!;
    const currentQuestFailsNeeded = failsNeeded(count, state.questIdx);
    const questSizes = QUEST_SIZES[count]!;
    const questFailsNeeded: [number, number, number, number, number] = [
      failsNeeded(count, 0),
      failsNeeded(count, 1),
      failsNeeded(count, 2),
      failsNeeded(count, 3),
      failsNeeded(count, 4),
    ];

    const viewerIsMerlinGuesser =
      !isSpectator &&
      state.phase === "merlinGuess" &&
      spiesIn(state.roles, state.playerOrder)[0] === viewer;

    return {
      phase: state.phase,
      playerOrder: [...state.playerOrder],
      leaderIdx: state.leaderIdx,
      leader,
      questIdx: state.questIdx,
      currentQuestSize,
      currentQuestFailsNeeded,
      questResults: state.questResults.slice(),
      questSizes: [
        questSizes[0],
        questSizes[1],
        questSizes[2],
        questSizes[3],
        questSizes[4],
      ],
      questFailsNeeded,
      proposalNumber: state.proposalNumber,
      proposedTeam: state.proposedTeam ? [...state.proposedTeam] : null,
      voteTally,
      questSubmissions,
      viewerRole,
      knownSpies,
      viewerIsMerlinGuesser,
      allRoles: isTerminal ? { ...state.roles } : null,
      merlinGuess: state.merlinGuess,
      winner: state.winner,
      winReason: state.winReason,
    };
  },

  phase(state: AvalonState): PhaseId {
    return state.phase;
  },

  currentActors(state: AvalonState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    if (state.phase === "proposal") {
      const leader = state.playerOrder[state.leaderIdx];
      return leader ? [leader] : [];
    }
    if (state.phase === "vote") {
      return state.playerOrder.filter((id) => state.votes[id] == null);
    }
    if (state.phase === "quest") {
      return Object.entries(state.questVotes)
        .filter(([, v]) => v == null)
        .map(([id]) => id);
    }
    if (state.phase === "merlinGuess") {
      const first = spiesIn(state.roles, state.playerOrder)[0];
      return first ? [first] : [];
    }
    return [];
  },

  isTerminal(state: AvalonState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: AvalonState): Outcome | null {
    if (!state.winner) return null;
    const losing: AvalonTeam = state.winner === "loyal" ? "spies" : "loyal";
    return {
      kind: "team",
      winningTeam: state.winner,
      losingTeams: [losing],
    };
  },
};

// Exported helpers for tests / tooling.
export { merlinIn, spiesIn };
