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
import words from "./words.json";
import {
  CODENAMES_TYPE,
  GRID_SIZE,
  configSchema,
  moveSchema,
  type Card,
  type CardRole,
  type CodenamesConfig,
  type CodenamesMove,
  type CodenamesState,
  type CodenamesView,
  type Role,
  type Team,
} from "./shared";

function pickGridRoles(rng: () => number): CardRole[] {
  // Standard Codenames distribution: 9 of the starting team, 8 of the other,
  // 7 neutral, 1 assassin = 25.
  const startRed = rng() < 0.5;
  const redCount = startRed ? 9 : 8;
  const blueCount = startRed ? 8 : 9;
  const roles: CardRole[] = [
    ...Array(redCount).fill("red" as CardRole),
    ...Array(blueCount).fill("blue" as CardRole),
    ...Array(7).fill("neutral" as CardRole),
    "assassin",
  ];
  return shuffle(roles, rng);
}

function pickWords(rng: () => number): string[] {
  return shuffle(words as string[], rng).slice(0, GRID_SIZE);
}

export const codenamesServerModule: GameModule<
  CodenamesState,
  CodenamesMove,
  CodenamesConfig,
  CodenamesView
> = {
  type: CODENAMES_TYPE,
  displayName: "Codenames",
  description:
    "Spymasters give one-word clues to help their team find their agents on a 5×5 grid. Don't guess the assassin.",
  minPlayers: 4,
  maxPlayers: 12,

  defaultConfig(): CodenamesConfig {
    return { teams: {}, spymasters: {} };
  },

  validateConfig(cfg: unknown): CodenamesConfig {
    return configSchema.parse(cfg);
  },

  createInitialState(
    players: Player[],
    cfg: CodenamesConfig,
    ctx: GameContext,
  ): CodenamesState {
    // Resolve teams: honour config, auto-assign the rest alternating.
    const teams: Record<PlayerId, Team> = {};
    const assigned: PlayerId[] = [];
    let next: Team = "red";
    for (const p of players) {
      const configured = cfg.teams?.[p.id];
      if (configured === "red" || configured === "blue") {
        teams[p.id] = configured;
      } else {
        teams[p.id] = next;
        next = next === "red" ? "blue" : "red";
      }
      assigned.push(p.id);
    }

    // Validate both teams have at least one player.
    const redPlayers = assigned.filter((id) => teams[id] === "red");
    const bluePlayers = assigned.filter((id) => teams[id] === "blue");
    if (redPlayers.length < 1 || bluePlayers.length < 1) {
      throw new Error("Codenames needs at least one player per team");
    }

    // Spymaster assignments: honour config; otherwise pick the first
    // player on each team.
    const roles: Record<PlayerId, Role> = {};
    const redSpy =
      cfg.spymasters?.red && redPlayers.includes(cfg.spymasters.red)
        ? cfg.spymasters.red
        : redPlayers[0]!;
    const blueSpy =
      cfg.spymasters?.blue && bluePlayers.includes(cfg.spymasters.blue)
        ? cfg.spymasters.blue
        : bluePlayers[0]!;
    for (const id of assigned) {
      roles[id] = id === redSpy || id === blueSpy ? "spymaster" : "operative";
    }

    // Build grid.
    const wordSet = pickWords(ctx.rng);
    const roleSet = pickGridRoles(ctx.rng);
    const startingTeam: Team =
      cfg.startingTeam ??
      (roleSet.filter((r) => r === "red").length === 9 ? "red" : "blue");
    const grid: Card[] = wordSet.map((word, i) => ({
      word,
      role: roleSet[i]!,
      revealed: false,
    }));

    return {
      grid,
      teams,
      roles,
      turn: startingTeam,
      phase: "cluing",
      clue: null,
      guessesLeft: 0,
      remaining: {
        red: roleSet.filter((r) => r === "red").length,
        blue: roleSet.filter((r) => r === "blue").length,
      },
      winner: null,
      winReason: null,
    };
  },

  handleMove(
    state: CodenamesState,
    move: CodenamesMove,
    actor: PlayerId,
    _ctx: GameContext,
  ): MoveResult<CodenamesState> {
    const parsed = moveSchema.safeParse(move);
    if (!parsed.success) return { ok: false, reason: "Malformed move" };
    if (state.phase === "gameOver") {
      return { ok: false, reason: "Game is over" };
    }
    const actorTeam = state.teams[actor];
    const actorRole = state.roles[actor];
    if (!actorTeam || !actorRole) {
      return { ok: false, reason: "You are not in this match" };
    }
    if (actorTeam !== state.turn) {
      return { ok: false, reason: "Not your team's turn" };
    }

    const m = parsed.data;

    if (m.kind === "giveClue") {
      if (state.phase !== "cluing") {
        return { ok: false, reason: "Clue already given for this turn" };
      }
      if (actorRole !== "spymaster") {
        return { ok: false, reason: "Only the spymaster can give clues" };
      }
      const normalized = m.word.trim();
      if (!normalized) return { ok: false, reason: "Clue cannot be empty" };

      return {
        ok: true,
        state: {
          ...state,
          phase: "guessing",
          clue: { word: normalized, count: m.count },
          guessesLeft: m.count + 1,
        },
      };
    }

    if (m.kind === "guess") {
      if (state.phase !== "guessing") {
        return { ok: false, reason: "Waiting on spymaster's clue" };
      }
      if (actorRole !== "operative") {
        return { ok: false, reason: "Spymaster cannot guess" };
      }
      const card = state.grid[m.cardIndex];
      if (!card) return { ok: false, reason: "Invalid card" };
      if (card.revealed) return { ok: false, reason: "Already revealed" };

      const grid = state.grid.map((c, i) =>
        i === m.cardIndex ? { ...c, revealed: true } : c,
      );
      const remaining = { ...state.remaining };
      if (card.role === "red") remaining.red -= 1;
      if (card.role === "blue") remaining.blue -= 1;

      // Assassin → game over; opposing team wins.
      if (card.role === "assassin") {
        return {
          ok: true,
          state: {
            ...state,
            grid,
            remaining,
            phase: "gameOver",
            winner: actorTeam === "red" ? "blue" : "red",
            winReason: "assassin",
            guessesLeft: 0,
          },
        };
      }

      // Check for last-card win.
      const teamCardRevealed = card.role === actorTeam;
      if (remaining.red === 0 || remaining.blue === 0) {
        const winner: Team = remaining.red === 0 ? "red" : "blue";
        return {
          ok: true,
          state: {
            ...state,
            grid,
            remaining,
            phase: "gameOver",
            winner,
            winReason: "lastCard",
            guessesLeft: 0,
          },
        };
      }

      if (!teamCardRevealed) {
        // Wrong guess (neutral or opposite team) → turn ends.
        return {
          ok: true,
          state: {
            ...state,
            grid,
            remaining,
            phase: "cluing",
            clue: null,
            guessesLeft: 0,
            turn: actorTeam === "red" ? "blue" : "red",
          },
        };
      }

      // Correct guess: decrement and continue, unless out of guesses.
      const nextGuesses = state.guessesLeft - 1;
      if (nextGuesses <= 0) {
        return {
          ok: true,
          state: {
            ...state,
            grid,
            remaining,
            phase: "cluing",
            clue: null,
            guessesLeft: 0,
            turn: actorTeam === "red" ? "blue" : "red",
          },
        };
      }
      return {
        ok: true,
        state: {
          ...state,
          grid,
          remaining,
          guessesLeft: nextGuesses,
        },
      };
    }

    if (m.kind === "endGuessing") {
      if (state.phase !== "guessing") {
        return { ok: false, reason: "Not in guessing phase" };
      }
      if (actorRole !== "operative") {
        return { ok: false, reason: "Spymaster cannot end guessing" };
      }
      return {
        ok: true,
        state: {
          ...state,
          phase: "cluing",
          clue: null,
          guessesLeft: 0,
          turn: actorTeam === "red" ? "blue" : "red",
        },
      };
    }

    return { ok: false, reason: "Unknown move" };
  },

  view(state: CodenamesState, viewer: Viewer): CodenamesView {
    const viewerTeam: Team | null =
      viewer === "spectator" ? null : state.teams[viewer] ?? null;
    const viewerRole: Role | null =
      viewer === "spectator" ? null : state.roles[viewer] ?? null;
    const isTerminal = state.phase === "gameOver";
    const isSameTeamSpymaster =
      viewerRole === "spymaster" &&
      viewerTeam !== null &&
      state.turn !== null; // all spymasters see their grid always

    const grid = state.grid.map((c) => ({
      word: c.word,
      revealed: c.revealed,
      role:
        c.revealed || isTerminal || (viewerRole === "spymaster" && !!viewerTeam)
          ? c.role
          : null,
    }));

    // Strip role when it shouldn't leak. We already did: role=null unless
    // revealed OR terminal OR viewer is a spymaster on any team (spymasters
    // see the whole grid regardless of turn).
    // Note: we deliberately show the entire grid to every spymaster because
    // in real Codenames both spymasters can see all colours at all times.

    // Also null-out clue word/count when viewer is the opposing spymaster? In
    // physical Codenames, clues are spoken aloud, so all players hear them.
    // We mirror that: everyone sees state.clue.

    // Final scrub: if viewer is NOT spymaster, strip role on unrevealed cards
    // unless terminal.
    const scrubbed = grid.map((c) => {
      if (c.revealed || isTerminal) return c;
      if (viewerRole === "spymaster") return c;
      return { ...c, role: null };
    });

    void isSameTeamSpymaster;

    return {
      grid: scrubbed,
      teams: { ...state.teams },
      roles: { ...state.roles },
      turn: state.turn,
      phase: state.phase,
      clue: state.clue,
      guessesLeft: state.guessesLeft,
      remaining: { ...state.remaining },
      winner: state.winner,
      winReason: state.winReason,
      viewerRole,
      viewerTeam,
    };
  },

  phase(state: CodenamesState): PhaseId {
    return state.phase;
  },

  currentActors(state: CodenamesState): PlayerId[] {
    if (state.phase === "gameOver") return [];
    return Object.entries(state.teams)
      .filter(([id, team]) => {
        if (team !== state.turn) return false;
        const role = state.roles[id];
        if (state.phase === "cluing") return role === "spymaster";
        return role === "operative";
      })
      .map(([id]) => id);
  },

  isTerminal(state: CodenamesState): boolean {
    return state.phase === "gameOver";
  },

  outcome(state: CodenamesState): Outcome | null {
    if (!state.winner) return null;
    const losingTeam: Team = state.winner === "red" ? "blue" : "red";
    return { kind: "team", winningTeam: state.winner, losingTeams: [losingTeam] };
  },
};
