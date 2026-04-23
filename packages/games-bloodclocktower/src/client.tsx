"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { GameEvent } from "@bgo/sdk";
import type {
  BoardProps,
  ClientGameModule,
  LobbyPanelProps,
} from "@bgo/sdk-client";
import {
  BOTC_TYPE,
  BUILT_IN_SCRIPT_IDS,
  FABLED_IDS,
  SCRIPT_LABELS,
  TB_DISTRIBUTION,
  ALL_CHARACTERS_BY_ID,
  parseScriptJson,
  tonightOrder,
  type BotCConfig,
  type BotCMove,
  type BotCPhase,
  type BotCView,
  type BuiltInScriptId,
  type Character,
  type CharacterTeam,
  type NightStep,
  type ReminderToken,
  type SeatGrimoire,
} from "./shared";

type SendInfoPayload = Extract<BotCMove, { kind: "st.sendInfo" }>["info"];
type OnEvent = (listener: (e: GameEvent) => void) => () => void;

/**
 * Active character pool for the current view. Custom-script inline
 * definitions take precedence over the canonical (TB / BMR / S&V /
 * Fabled) pool so a homebrew script can shadow built-ins.
 *
 * Threaded as a context so we don't have to drill it into every leaf
 * component that resolves an id → Character.
 */
const CharacterPoolContext = createContext<Record<string, Character>>(
  ALL_CHARACTERS_BY_ID,
);

function useCharacterPool(): Record<string, Character> {
  return useContext(CharacterPoolContext);
}

function buildCharacterPool(custom: Character[]): Record<string, Character> {
  if (custom.length === 0) return ALL_CHARACTERS_BY_ID;
  const out: Record<string, Character> = { ...ALL_CHARACTERS_BY_ID };
  for (const c of custom) out[c.id] = c;
  return out;
}

/**
 * Hex colors for the SVG role tokens — picked to read well on the
 * cream `--token-bg` background and to stay visually distinct in
 * grayscale. Townsfolk = trustworthy blue; Outsider = warning amber;
 * Minion = oxblood; Demon = bright red; Traveller = neutral; Fabled
 * = secondary purple-ish.
 */
const TEAM_HEX: Record<CharacterTeam, string> = {
  townsfolk: "#1e6f9f",
  outsider: "#9c6b1c",
  minion: "#a02c2c",
  demon: "#d63a3a",
  traveller: "#6b6b6b",
  fabled: "#7a4ea6",
};

/**
 * A circular SVG "role token" loosely inspired by the physical BotC
 * tokens: cream background, team-colored border, character name as
 * curved text along the bottom arc, large stylized initial in the
 * middle (until we have art).
 *
 * Status overlays:
 *   - Dead: wooden-slat shroud across the middle.
 *   - Poisoned / Drunk: small dots in the bottom corners.
 */
function RoleToken({
  character,
  size = 88,
  dead = false,
  poisoned = false,
  drunk = false,
}: {
  character: Character | null;
  size?: number;
  dead?: boolean;
  poisoned?: boolean;
  drunk?: boolean;
}) {
  const teamColor = character ? TEAM_HEX[character.team] : "#999";
  const name = character?.name ?? "";
  // For empty / unassigned tokens, render just the cream circle.
  // Curved name path: a downward arc that reads bottom-up. Inkscape-y
  // d-string: starts at left side, sweeps along the bottom to the
  // right side, hugging the inner edge of the border ring.
  const arcId = `tokenArc-${character?.id ?? "empty"}-${size}`;
  const initial = name ? name[0]?.toUpperCase() ?? "" : "";
  // Font size for the curved name scales gently with token size.
  const nameFontSize = Math.max(7, Math.round(size / 11));
  const initialFontSize = Math.round(size / 2.5);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ display: "block" }}
      aria-label={name || "empty seat"}
    >
      <defs>
        {/* Subtle radial gradient on the token surface for depth. */}
        <radialGradient id={`tokenSheen-${arcId}`} cx="0.5" cy="0.4" r="0.6">
          <stop offset="0%" stopColor="#fbf6e9" />
          <stop offset="80%" stopColor="#ede1c6" />
          <stop offset="100%" stopColor="#d8c79b" />
        </radialGradient>
        {/* Bottom arc for the curved character name. */}
        <path id={arcId} d="M 18 56 A 32 32 0 0 0 82 56" fill="none" />
      </defs>

      {/* Outer team-colored ring */}
      <circle cx="50" cy="50" r="48" fill={teamColor} opacity="0.85" />
      {/* Inner token surface */}
      <circle
        cx="50"
        cy="50"
        r="42"
        fill={`url(#tokenSheen-${arcId})`}
        stroke={teamColor}
        strokeWidth="0.5"
      />

      {/* Big stylized initial in the middle */}
      {initial && (
        <text
          x="50"
          y="42"
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="'Cormorant Garamond', 'Georgia', serif"
          fontWeight="600"
          fontSize={initialFontSize}
          fill={teamColor}
        >
          {initial}
        </text>
      )}

      {/* Curved character name along the bottom */}
      {name && (
        <text
          fontFamily="'Cormorant Garamond', 'Georgia', serif"
          fontWeight="600"
          fontSize={nameFontSize}
          fill={teamColor}
          letterSpacing="0.5"
        >
          <textPath href={`#${arcId}`} startOffset="50%" textAnchor="middle">
            {name.toUpperCase()}
          </textPath>
        </text>
      )}

      {/* Death shroud — a brown wooden slat tilted slightly */}
      {dead && (
        <g opacity="0.85" transform="rotate(-8 50 60)">
          <rect x="6" y="55" width="88" height="13" fill="#3b2e1e" />
          <rect x="6" y="55" width="88" height="2" fill="#5a4630" />
          <rect x="6" y="66" width="88" height="2" fill="#241a10" />
          <text
            x="50"
            y="65"
            textAnchor="middle"
            fontSize="6"
            fill="#e8d8b8"
            fontFamily="'Cormorant Garamond', 'Georgia', serif"
            letterSpacing="2"
          >
            DEAD
          </text>
        </g>
      )}

      {/* Status corner dots */}
      {poisoned && (
        <g>
          <circle cx="82" cy="82" r="7" fill="#c47a1a" stroke="#fff" strokeWidth="1.5" />
          <text x="82" y="85" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="serif" fontWeight="700">P</text>
        </g>
      )}
      {drunk && (
        <g>
          <circle cx="18" cy="82" r="7" fill="#8e5fbf" stroke="#fff" strokeWidth="1.5" />
          <text x="18" y="85" textAnchor="middle" fontSize="9" fill="#fff" fontFamily="serif" fontWeight="700">D</text>
        </g>
      )}
    </svg>
  );
}

type Send = (move: BotCMove) => Promise<void>;
type SeatPlayer = { id: string; name: string };

const TEAM_LABEL: Record<CharacterTeam, string> = {
  townsfolk: "Townsfolk",
  outsider: "Outsiders",
  minion: "Minions",
  demon: "Demons",
  traveller: "Travellers",
  fabled: "Fabled",
};

const TEAM_TINT: Record<CharacterTeam, string> = {
  townsfolk: "text-info",
  outsider: "text-warning",
  minion: "text-error/80",
  demon: "text-error",
  traveller: "text-base-content/60",
  fabled: "text-secondary",
};

function BotCBoard({
  view,
  players,
  sendMove,
  onEvent,
}: BoardProps<BotCView, BotCMove>) {
  const customCharacters =
    view.viewer === "storyteller"
      ? view.state.customCharacters
      : view.customCharacters;
  const pool = useMemo(
    () => buildCharacterPool(customCharacters),
    [customCharacters],
  );
  return (
    <CharacterPoolContext.Provider value={pool}>
      {view.viewer === "storyteller" && (
        <StorytellerSurface
          view={view}
          players={players}
          sendMove={sendMove}
        />
      )}
      {view.viewer === "spectator" && (
        <SpectatorPlaceholder view={view} players={players} />
      )}
      {view.viewer === "player" && (
        <PlayerSurface
          view={view}
          players={players}
          sendMove={sendMove}
          onEvent={onEvent}
        />
      )}
    </CharacterPoolContext.Provider>
  );
}

// ============================================================================
// Storyteller
// ============================================================================

function StorytellerSurface({
  view,
  players,
  sendMove,
}: {
  view: Extract<BotCView, { viewer: "storyteller" }>;
  players: SeatPlayer[];
  sendMove: Send;
}) {
  const { state } = view;
  if (state.phase === "setup") {
    return <StorytellerSetup state={state} players={players} sendMove={sendMove} />;
  }
  return <StorytellerGrimoire state={state} players={players} sendMove={sendMove} />;
}

function StorytellerSetup({
  state,
  players,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  players: SeatPlayer[];
  sendMove: Send;
}) {
  const pool = useCharacterPool();
  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );

  const scriptCharacters = useMemo(
    () =>
      state.scriptCharacterIds
        .map((id) => pool[id])
        .filter((c): c is Character => Boolean(c)),
    [state.scriptCharacterIds],
  );

  const charactersByTeam = useMemo(() => {
    const groups: Partial<Record<CharacterTeam, Character[]>> = {};
    for (const c of scriptCharacters) {
      (groups[c.team] ??= []).push(c);
    }
    return groups;
  }, [scriptCharacters]);

  // Current draft = whatever is in the grimoire right now (server is the
  // source of truth — every dropdown change autosaves).
  const draft = useMemo(() => {
    const m: Record<string, string | null> = {};
    for (const seatId of state.seatOrder) {
      m[seatId] = state.grimoire[seatId]?.characterId ?? null;
    }
    return m;
  }, [state.seatOrder, state.grimoire]);

  const counts = useMemo(() => countByTeam(draft, scriptCharacters), [
    draft,
    scriptCharacters,
  ]);

  const recommended = TB_DISTRIBUTION[state.seatOrder.length] ?? [0, 0, 0, 0];
  const allAssigned = state.seatOrder.every((id) => draft[id]);

  const setSeat = async (seatId: string, characterId: string | null) => {
    const next = { ...draft, [seatId]: characterId };
    const assignments = filterAssignments(next);
    if (Object.keys(assignments).length === 0) return; // never send empty
    await sendMove({ kind: "st.assignCharacters", assignments });
  };

  const autoAssign = async () => {
    const picked = pickBalanced(scriptCharacters, state.seatOrder.length);
    if (!picked || picked.length < state.seatOrder.length) {
      // Custom script is too thin to populate every seat at the
      // recommended T/O/M/D split. Bail rather than send a partial
      // assignment that the ST didn't intend.
      return;
    }
    const shuffled = shuffle(picked);
    const next: Record<string, string> = {};
    state.seatOrder.forEach((seatId, i) => {
      next[seatId] = shuffled[i]!.id;
    });
    await sendMove({ kind: "st.assignCharacters", assignments: next });
  };

  const startFirstNight = async () => {
    await sendMove({ kind: "st.advancePhase" });
  };

  return (
    <div className="max-w-3xl w-full flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Storyteller · setup · {scriptDisplayName(state.scriptId)}
        </span>
        <h2 className="font-display text-2xl tracking-tight">
          Distribute characters
        </h2>
      </header>

      <div className="surface-ivory p-5 flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div className="text-sm text-base-content/70">
            <span className="font-display text-base-content/85 mr-1.5">
              {state.seatOrder.length} players
            </span>
            recommends
            <DistributionStat
              label="T"
              picked={counts.townsfolk}
              target={recommended[0]}
              tint={TEAM_TINT.townsfolk}
            />
            <DistributionStat
              label="O"
              picked={counts.outsider}
              target={recommended[1]}
              tint={TEAM_TINT.outsider}
            />
            <DistributionStat
              label="M"
              picked={counts.minion}
              target={recommended[2]}
              tint={TEAM_TINT.minion}
            />
            <DistributionStat
              label="D"
              picked={counts.demon}
              target={recommended[3]}
              tint={TEAM_TINT.demon}
            />
          </div>
          <button
            type="button"
            className="btn btn-sm rounded-full px-4"
            onClick={autoAssign}
          >
            Auto-assign balanced
          </button>
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {state.seatOrder.map((seatId) => {
            const player = playerById[seatId];
            const current = draft[seatId];
            return (
              <li
                key={seatId}
                className="flex items-center gap-3 px-3 py-2 rounded-md bg-base-100/60"
              >
                <span className="font-display text-sm w-32 truncate">
                  {player?.name ?? seatId}
                </span>
                <select
                  className="flex-1 bg-transparent text-sm outline-none"
                  value={current ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    if (v !== current) void setSeat(seatId, v);
                  }}
                >
                  <option value="">— pick —</option>
                  {(["townsfolk", "outsider", "minion", "demon"] as const).map(
                    (team) => {
                      const chars = charactersByTeam[team] ?? [];
                      if (chars.length === 0) return null;
                      return (
                        <optgroup key={team} label={TEAM_LABEL[team]}>
                          {chars.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </optgroup>
                      );
                    },
                  )}
                </select>
              </li>
            );
          })}
        </ul>
      </div>

      <button
        type="button"
        className="btn btn-primary self-end rounded-full px-6"
        onClick={startFirstNight}
        disabled={!allAssigned}
      >
        {allAssigned
          ? "Start the first night →"
          : `Assign ${state.seatOrder.length - countAssigned(draft)} more to start`}
      </button>
    </div>
  );
}

function DistributionStat({
  label,
  picked,
  target,
  tint,
}: {
  label: string;
  picked: number;
  target: number;
  tint: string;
}) {
  const ok = picked === target;
  return (
    <span className="ml-3 inline-flex items-baseline gap-1 font-mono text-sm">
      <span className={`${tint} font-semibold`}>{label}</span>
      <span className={ok ? "text-base-content/85" : "text-base-content/60"}>
        {picked}/{target}
      </span>
    </span>
  );
}

/**
 * Single-viewport ST grimoire. Modeled after clocktower.online: ring
 * fills the canvas, center has phase-aware controls, left rail (when
 * night) has the wake order, right rail (when a seat is selected)
 * has the SeatSheet for editing. No vertical scroll past the
 * grimoire — everything fits the tablet viewport.
 */
function StorytellerGrimoire({
  state,
  players,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  players: SeatPlayer[];
  sendMove: Send;
}) {
  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );

  const livingCount = state.seatOrder.reduce(
    (n, id) => n + (state.grimoire[id]?.isAlive ? 1 : 0),
    0,
  );

  const advance = () => sendMove({ kind: "st.advancePhase" });
  const advanceLabel = phaseAdvanceLabel(state.phase, state.dayNumber);
  const isNight = state.phase === "firstNight" || state.phase === "night";
  const isFinished = state.phase === "finished";
  const isDay = state.phase === "day";

  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null);
  const [hoveredSeatId, setHoveredSeatId] = useState<string | null>(null);
  const [endingMatch, setEndingMatch] = useState(false);
  const [pendingNomination, setPendingNomination] = useState<
    { nominator: string | null } | null
  >(null);

  // If a seat goes away (post-rematch player swap), clear selection.
  useEffect(() => {
    if (selectedSeatId && !state.grimoire[selectedSeatId]) {
      setSelectedSeatId(null);
    }
  }, [selectedSeatId, state.grimoire]);

  // Sheet shows hovered seat (transient preview) when present; falls back
  // to the pinned (clicked) selection. Touch devices generally don't fire
  // mouseEnter, so they get the click-to-pin behavior unchanged.
  const displayedSeatId = hoveredSeatId ?? selectedSeatId;

  // The set of character ids actually assigned to seats — drives the
  // available reminder-token list in the SeatSheet so the ST can pick
  // any reminder that might come up tonight, not just the seat's own.
  const inPlayCharacterIds = useMemo(() => {
    const set = new Set<string>();
    for (const seat of Object.values(state.grimoire)) {
      if (seat.characterId) set.add(seat.characterId);
    }
    return set;
  }, [state.grimoire]);

  // The nomination flow ends once a vote opens.
  useEffect(() => {
    if (state.openVote && pendingNomination) setPendingNomination(null);
  }, [state.openVote, pendingNomination]);

  // Highlight ring seats during the 2-tap nomination flow.
  const highlightSeatIds = useMemo(() => {
    if (!pendingNomination || !isDay || state.playMode !== "virtual") {
      return undefined;
    }
    const set = new Set<string>();
    if (pendingNomination.nominator === null) {
      // Picking nominator — highlight all living seats.
      for (const id of state.seatOrder) {
        if (state.grimoire[id]?.isAlive) set.add(id);
      }
    } else {
      // Picking nominee — highlight everyone who isn't already a nominee
      // today and isn't the nominator themselves.
      const taken = new Set(state.nominations.map((n) => n.nominee));
      for (const id of state.seatOrder) {
        if (
          id !== pendingNomination.nominator &&
          !taken.has(id) &&
          state.grimoire[id]
        ) {
          set.add(id);
        }
      }
    }
    return set;
  }, [
    pendingNomination,
    isDay,
    state.playMode,
    state.seatOrder,
    state.grimoire,
    state.nominations,
  ]);

  // Yes-vote raised hands (visible to ST; will be public to all once
  // spinning-hand server changes land).
  const voteYesSeats = useMemo(() => {
    if (!state.openVote) return undefined;
    const set = new Set<string>();
    for (const [seatId, v] of Object.entries(state.openVote.votes)) {
      if (v === "yes") set.add(seatId);
    }
    return set;
  }, [state.openVote]);

  /**
   * Routes a ring-token tap depending on what mode we're in.
   *  - Virtual day with a pendingNomination: complete the nominator/nominee step.
   *  - Otherwise: open / toggle the SeatSheet.
   */
  const handleSeatClick = (seatId: string) => {
    if (
      isDay &&
      state.playMode === "virtual" &&
      pendingNomination &&
      !state.openVote
    ) {
      if (pendingNomination.nominator === null) {
        if (state.grimoire[seatId]?.isAlive) {
          setPendingNomination({ nominator: seatId });
        }
        return;
      }
      const nominator = pendingNomination.nominator;
      if (seatId === nominator) {
        setPendingNomination(null);
        return;
      }
      if (state.nominations.some((n) => n.nominee === seatId)) return;
      void sendMove({
        kind: "st.openNomination",
        nominator,
        nominee: seatId,
      });
      setPendingNomination(null);
      return;
    }
    setSelectedSeatId(seatId === selectedSeatId ? null : seatId);
  };

  return (
    <div className="w-full flex flex-col gap-3">
      <header className="flex items-center justify-between gap-3 flex-wrap px-1">
        <div className="flex flex-col leading-tight">
          <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
            Storyteller · {phaseLabel(state.phase, state.dayNumber)} ·{" "}
            {livingCount}/{state.seatOrder.length} alive ·{" "}
            {state.playMode === "irl" ? "in-person" : "virtual"}
          </span>
          <h2 className="font-display text-xl tracking-tight">
            {scriptDisplayName(state.scriptId)}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!isFinished && (
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-full border border-base-content/20 text-base-content/65 hover:bg-base-content/5"
              onClick={() => setEndingMatch(true)}
            >
              End match…
            </button>
          )}
          {advanceLabel && (
            <button
              type="button"
              className="btn btn-primary rounded-full px-5"
              onClick={advance}
            >
              {advanceLabel}
            </button>
          )}
        </div>
      </header>

      {isFinished && state.winner && (
        <FinishedBanner winner={state.winner} reason={state.endReason} />
      )}

      {/* Main grimoire surface. Sized so the whole thing fits a typical
          tablet viewport (1024×768 landscape) without any internal
          scrolling. Inner panels (rails, sheet) overlay the ring with a
          translucent backdrop so seats behind them remain visible. */}
      <div
        className="relative w-full rounded-2xl border border-base-content/10 bg-base-100/40 overflow-hidden"
        style={{
          height: "min(calc(100vh - 280px), 640px)",
          minHeight: 500,
        }}
      >
        <SeatRing
          seatOrder={state.seatOrder}
          grimoire={state.grimoire}
          playerById={playerById}
          selectedSeatId={selectedSeatId}
          hoveredSeatId={hoveredSeatId}
          onSeatClick={handleSeatClick}
          onSeatHover={setHoveredSeatId}
          highlightSeatIds={highlightSeatIds}
          voteYesSeats={voteYesSeats}
          spinningHand={
            state.openVote &&
            state.openVote.spinPhase === "spinning" &&
            state.openVote.spinStartedAt !== null
              ? {
                  spinStartedAt: state.openVote.spinStartedAt,
                  cadenceMs: state.openVote.cadenceMs,
                  spinOrder: state.openVote.spinOrder,
                }
              : undefined
          }
        />

        <CenterControls
          state={state}
          playerById={playerById}
          sendMove={sendMove}
          pendingNomination={pendingNomination}
          setPendingNomination={setPendingNomination}
        />

        {isNight && (
          <aside className="absolute left-2 top-2 bottom-2 w-60 z-30 pointer-events-auto overflow-y-auto rounded-lg">
            <NightOrderPanel
              state={state}
              playerById={playerById}
              sendMove={sendMove}
            />
          </aside>
        )}

        {displayedSeatId && state.grimoire[displayedSeatId] && (
          <aside
            className="absolute right-2 top-2 bottom-2 w-64 z-30 pointer-events-auto"
            onMouseEnter={() => setHoveredSeatId(displayedSeatId)}
            onMouseLeave={() => setHoveredSeatId(null)}
          >
            <SeatSheet
              seatId={displayedSeatId}
              seat={state.grimoire[displayedSeatId]!}
              playerName={
                playerById[displayedSeatId]?.name ?? displayedSeatId
              }
              phase={state.phase}
              playMode={state.playMode}
              hasOpenVote={state.openVote !== null}
              isPinned={selectedSeatId === displayedSeatId}
              inPlayCharacterIds={inPlayCharacterIds}
              onClose={() => {
                setSelectedSeatId(null);
                setHoveredSeatId(null);
              }}
              sendMove={sendMove}
            />
          </aside>
        )}

        {/* Day execution log — small horizontal strip at the bottom so
            past nominations / executions stay visible without crowding
            the ring. */}
        {isDay && state.executions.length > 0 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 max-w-[80%] z-10 pointer-events-none">
            <ul className="flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[10px] text-base-content/45 font-mono bg-base-100/70 backdrop-blur px-3 py-1 rounded-full">
              {state.executions.slice(-4).map((e, i) => (
                <li key={i} className="whitespace-nowrap">
                  d{e.dayNumber}:{" "}
                  {e.executed
                    ? (playerById[e.executed]?.name ?? e.executed)
                    : "—"}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fabled corner — always present but compact. */}
        {(state.fabled.length > 0 || !isFinished) && (
          <div className="absolute bottom-3 right-3 z-20 max-w-[260px] pointer-events-auto">
            <FabledPanel fabled={state.fabled} sendMove={sendMove} compact />
          </div>
        )}
      </div>

      {endingMatch && (
        <EndMatchModal
          onConfirm={(winner, reason) => {
            void sendMove({ kind: "st.endMatch", winner, reason });
            setEndingMatch(false);
          }}
          onCancel={() => setEndingMatch(false)}
        />
      )}
    </div>
  );
}

/**
 * Token size + ring radius for a given seat count. Tuned to fit a
 * ~500px container at 15 players (so the ring stays inside a tablet
 * viewport between the night-order rail and the seat sheet), while
 * still leaving room for the ~140-wide center controls.
 */
function ringGeometry(n: number) {
  const tokenSize =
    n <= 6 ? 96 : n <= 9 ? 80 : n <= 11 ? 72 : n <= 13 ? 64 : 58;
  const minGap = tokenSize * 1.18;
  const radius = Math.max(150, minGap / (2 * Math.sin(Math.PI / n)));
  // Reserve room for the center controls (~140 wide) — push the ring
  // out if it'd otherwise crowd the center.
  const radiusCenterGuarded = Math.max(radius, tokenSize / 2 + 88);
  // Container has to fit the outermost token edge + a label band (the
  // player name renders below each token). 32 below + 4 above is enough
  // for a single-line text-[11px] label with leading-tight.
  const labelPadding = 36;
  const containerSize =
    (radiusCenterGuarded + tokenSize / 2) * 2 + labelPadding;
  return {
    tokenSize,
    radius: radiusCenterGuarded,
    containerSize,
  };
}

/**
 * Town-square ring. The whole grimoire is built around this — tokens
 * are clickable to open a SeatSheet on the right, the center is left
 * empty for CenterControls, and the night-order rail floats on the
 * left during night phases.
 *
 * Tokens are absolutely positioned by polar coordinates from the
 * container center, starting at -90° (top) and going clockwise.
 */
function SeatRing({
  seatOrder,
  grimoire,
  playerById,
  selectedSeatId,
  hoveredSeatId,
  onSeatClick,
  onSeatHover,
  highlightSeatIds,
  voteYesSeats,
  spinningHand,
}: {
  seatOrder: readonly string[];
  grimoire: Extract<BotCView, { viewer: "storyteller" }>["state"]["grimoire"];
  playerById: Record<string, SeatPlayer>;
  /** Pinned seat (sticky — opened via click, persists). */
  selectedSeatId: string | null;
  /** Currently-hovered seat for transient preview (desktop only). */
  hoveredSeatId: string | null;
  onSeatClick: (id: string) => void;
  /** Mouse enter / leave on a seat token. Pass null on leave. */
  onSeatHover: (id: string | null) => void;
  /** Seats to outline — used by the nomination flow to mark candidates. */
  highlightSeatIds?: ReadonlySet<string>;
  /** Seats currently voting "yes" — surfaces a raised-hand chip. */
  voteYesSeats?: ReadonlySet<string>;
  /** When set, draws the spinning vote hand sweeping clockwise. */
  spinningHand?: {
    spinStartedAt: number;
    cadenceMs: number;
    spinOrder: readonly string[];
  };
}) {
  const pool = useCharacterPool();
  const n = seatOrder.length;
  if (n === 0) return null;
  const { tokenSize, radius, containerSize } = ringGeometry(n);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
    >
      <div
        className="relative pointer-events-none"
        style={{
          width: containerSize,
          height: containerSize,
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      >
        {spinningHand && (
          <SpinningHandOverlay
            spinningHand={spinningHand}
            seatOrder={seatOrder}
            containerSize={containerSize}
            radius={radius}
          />
        )}
        {seatOrder.map((seatId, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const seat = grimoire[seatId];
          const c = seat?.characterId ? (pool[seat.characterId] ?? null) : null;
          const playerName = playerById[seatId]?.name ?? seatId;
          const isSelected = selectedSeatId === seatId;
          const isHovered = hoveredSeatId === seatId;
          const isHighlighted = highlightSeatIds?.has(seatId) ?? false;
          const showHand = voteYesSeats?.has(seatId) ?? false;
          return (
            <button
              key={seatId}
              type="button"
              onClick={() => onSeatClick(seatId)}
              onMouseEnter={() => onSeatHover(seatId)}
              onMouseLeave={() => onSeatHover(null)}
              onFocus={() => onSeatHover(seatId)}
              onBlur={() => onSeatHover(null)}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                width: tokenSize + 18,
              }}
              className={`flex flex-col items-center gap-1 group focus:outline-none transition-transform pointer-events-auto ${
                isSelected ? "scale-110 z-20" : "hover:scale-105"
              }`}
              aria-label={`${playerName}${c ? ` — ${c.name}` : ""}`}
            >
              <span
                className={`relative rounded-full transition-shadow ${
                  isSelected
                    ? "ring-4 ring-primary/70 shadow-[0_0_18px_rgba(179,90,31,0.4)]"
                    : isHovered
                      ? "ring-2 ring-primary/40 shadow-[0_0_12px_rgba(179,90,31,0.2)]"
                      : isHighlighted
                        ? "ring-4 ring-info/60"
                        : ""
                }`}
              >
                <RoleToken
                  character={c}
                  size={tokenSize}
                  dead={!seat?.isAlive}
                  poisoned={seat?.isPoisoned}
                  drunk={seat?.isDrunk}
                />
                {showHand && (
                  <span
                    className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-warning text-warning-content shadow-md"
                    style={{
                      width: Math.round(tokenSize * 0.32),
                      height: Math.round(tokenSize * 0.32),
                      fontSize: Math.round(tokenSize * 0.22),
                    }}
                    aria-label="voting yes"
                  >
                    ✋
                  </span>
                )}
              </span>
              <span
                className={`font-display text-[11px] text-center truncate w-full leading-tight ${
                  isSelected ? "text-primary" : "text-base-content/85"
                }`}
              >
                {playerName}
              </span>
              {seat?.reminders && seat.reminders.length > 0 && (
                <div
                  className="flex flex-wrap gap-0.5 justify-center"
                  style={{ maxWidth: tokenSize + 36 }}
                >
                  {seat.reminders.slice(0, 4).map((r) => (
                    <span
                      key={r.id}
                      className="px-1 rounded-sm bg-amber-200 text-amber-950 text-[9px] leading-[1.4] font-display whitespace-nowrap shadow-sm border border-amber-300/50"
                      title={r.label}
                    >
                      {r.label.length > 12
                        ? r.label.slice(0, 11) + "…"
                        : r.label}
                    </span>
                  ))}
                  {seat.reminders.length > 4 && (
                    <span className="px-1 rounded-sm bg-base-content/15 text-base-content/65 text-[9px] leading-[1.4] font-mono">
                      +{seat.reminders.length - 4}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Animated SVG hand sweeping clockwise across the ring during a
 * spinning vote. Uses a CSS keyframe animation with a negative
 * `animation-delay` so every client lands on the same hand position
 * regardless of when they joined / reconnected — the spin is
 * deterministic from `spinStartedAt + cadenceMs`.
 *
 * The hand's start angle is the position of the first seat in
 * spinOrder (the seat immediately left of the nominee). It rotates
 * 360° over `spinOrder.length * cadenceMs` ms, so it ends back at
 * the start.
 */
function SpinningHandOverlay({
  spinningHand,
  seatOrder,
  containerSize,
  radius,
}: {
  spinningHand: {
    spinStartedAt: number;
    cadenceMs: number;
    spinOrder: readonly string[];
  };
  seatOrder: readonly string[];
  containerSize: number;
  radius: number;
}) {
  const n = seatOrder.length;
  const firstIdx = seatOrder.indexOf(spinningHand.spinOrder[0]!);
  if (firstIdx === -1) return null;
  // Same polar layout as SeatRing: angle(i) = i/n * 360° - 90°.
  const startAngleDeg = (firstIdx / n) * 360 - 90;
  const totalDurationMs =
    spinningHand.spinOrder.length * spinningHand.cadenceMs;
  // negative delay starts the animation in the past, keeping all
  // clients in sync regardless of when this component mounted.
  const elapsedMs = Date.now() - spinningHand.spinStartedAt;
  const animDelayMs = -elapsedMs;
  // Per-spin animation name so React doesn't reuse the same keyframes
  // across consecutive spins.
  const animName = `spinHand_${spinningHand.spinStartedAt}`;
  const cx = containerSize / 2;
  const cy = containerSize / 2;
  const tipX = cx + radius;
  const tipY = cy;

  return (
    <>
      <style>{`
        @keyframes ${animName} {
          from { transform: rotate(${startAngleDeg}deg); }
          to   { transform: rotate(${startAngleDeg + 360}deg); }
        }
      `}</style>
      <svg
        className="absolute pointer-events-none"
        width={containerSize}
        height={containerSize}
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 5,
        }}
        aria-hidden
      >
        <g
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: `${animName} ${totalDurationMs}ms linear forwards`,
            animationDelay: `${animDelayMs}ms`,
          }}
        >
          <line
            x1={cx}
            y1={cy}
            x2={tipX}
            y2={tipY}
            stroke="rgba(179, 90, 31, 0.55)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle
            cx={tipX}
            cy={tipY}
            r="9"
            fill="rgba(179, 90, 31, 0.92)"
            stroke="rgba(255, 250, 240, 0.9)"
            strokeWidth="2"
          />
        </g>
      </svg>
    </>
  );
}

/**
 * Right-rail edit sheet for one seat. Replaces the old SeatCard grid —
 * the ST taps a token in the ring and this slides in with full edit
 * controls (alive / poisoned / drunk, reminder tokens, character
 * info, plus phase-specific actions like a big "Execute" button on
 * day phase).
 */
function SeatSheet({
  seatId,
  seat,
  playerName,
  phase,
  playMode,
  hasOpenVote,
  isPinned,
  inPlayCharacterIds,
  onClose,
  sendMove,
}: {
  seatId: string;
  seat: SeatGrimoire;
  playerName: string;
  phase: BotCPhase;
  playMode: "irl" | "virtual";
  hasOpenVote: boolean;
  /** True when opened via click (sheet stays); false when hover-preview only. */
  isPinned: boolean;
  /** All character ids currently assigned to seats — used to surface every
      reminder token that could plausibly come up tonight. */
  inPlayCharacterIds: ReadonlySet<string>;
  onClose: () => void;
  sendMove: Send;
}) {
  const pool = useCharacterPool();
  const character = seat.characterId
    ? (pool[seat.characterId] ?? null)
    : null;
  const [reminderDraft, setReminderDraft] = useState("");

  // All reminders available from in-play characters, grouped per source
  // character so the ST can scan by who-it-came-from. Own-character
  // reminders are first since they're the most likely to be added.
  const reminderGroups = useMemo(() => {
    const groups: Array<{ character: Character; labels: string[] }> = [];
    const addGroup = (cid: string) => {
      const c = pool[cid];
      if (!c || c.reminders.length === 0) return;
      if (groups.some((g) => g.character.id === cid)) return;
      groups.push({ character: c, labels: c.reminders });
    };
    if (character) addGroup(character.id);
    for (const cid of inPlayCharacterIds) {
      if (cid !== character?.id) addGroup(cid);
    }
    return groups;
  }, [pool, character, inPlayCharacterIds]);

  const setAlive = (alive: boolean) =>
    sendMove({ kind: "st.setAlive", seatId, alive });
  const setPoisoned = (poisoned: boolean) =>
    sendMove({ kind: "st.setPoisoned", seatId, poisoned });
  const setDrunk = (drunk: boolean) =>
    sendMove({ kind: "st.setDrunk", seatId, drunk });
  const addReminder = (label: string, characterId?: string) =>
    sendMove({
      kind: "st.addReminder",
      seatId,
      label,
      ...(characterId ? { characterId } : {}),
    });
  const removeReminder = (reminderId: string) =>
    sendMove({ kind: "st.removeReminder", seatId, reminderId });
  const execute = () =>
    sendMove({ kind: "st.executeNominee", nomineeId: seatId });

  const submitDraft = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = reminderDraft.trim();
    if (!trimmed) return;
    void addReminder(trimmed.slice(0, 48));
    setReminderDraft("");
  };

  const canExecute =
    phase === "day" && seat.isAlive && (playMode === "irl" || !hasOpenVote);

  return (
    <section
      className={`surface-ivory shadow-xl flex flex-col gap-3 p-4 overflow-y-auto h-full transition-opacity ${
        seat.isAlive ? "" : "opacity-90"
      }`}
    >
      <header className="flex items-start justify-between gap-2 -mt-1">
        <div className="flex items-center gap-3 min-w-0">
          <RoleToken
            character={character}
            size={48}
            dead={!seat.isAlive}
            poisoned={seat.isPoisoned}
            drunk={seat.isDrunk}
          />
          <div className="min-w-0 flex flex-col">
            <span className="font-display text-base truncate">
              {playerName}
            </span>
            {character ? (
              <span
                className={`font-mono text-[11px] uppercase tracking-wider ${TEAM_TINT[character.team]}`}
              >
                {character.name}
              </span>
            ) : (
              <span className="font-mono text-[11px] text-base-content/40">
                no character
              </span>
            )}
            {!isPinned && (
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-base-content/40">
                preview · click to pin
              </span>
            )}
          </div>
        </div>
        {isPinned && (
          <button
            type="button"
            onClick={onClose}
            className="text-base-content/45 hover:text-base-content/85 text-xl leading-none -mt-0.5"
            aria-label="Close seat sheet"
          >
            ×
          </button>
        )}
      </header>

      {character && (
        <p className="text-xs text-base-content/70 leading-relaxed border-l-2 border-base-content/15 pl-3 -ml-1">
          {character.ability}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <Pill
          on={!seat.isAlive}
          tint="error"
          onClick={() => void setAlive(!seat.isAlive)}
        >
          {seat.isAlive ? "alive" : "dead"}
        </Pill>
        <Pill
          on={seat.isPoisoned}
          tint="warning"
          onClick={() => void setPoisoned(!seat.isPoisoned)}
        >
          poisoned
        </Pill>
        <Pill
          on={seat.isDrunk}
          tint="warning"
          onClick={() => void setDrunk(!seat.isDrunk)}
        >
          drunk
        </Pill>
        {!seat.isAlive && (
          <Pill
            on={seat.ghostVoteUsed}
            tint="info"
            onClick={() => {
              /* read-only here; ghost vote is consumed in the vote flow */
            }}
          >
            {seat.ghostVoteUsed ? "ghost vote used" : "ghost vote"}
          </Pill>
        )}
      </div>

      {canExecute && (
        <button
          type="button"
          onClick={() => void execute()}
          className="self-start text-sm px-4 py-2 rounded-lg border border-error/35 text-error bg-error/5 hover:bg-error/15"
        >
          Execute {playerName}
        </button>
      )}

      {seat.reminders.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            On this seat
          </span>
          <ul className="flex flex-wrap gap-1 text-[11px]">
            {seat.reminders.map((r) => (
              <ReminderChip
                key={r.id}
                reminder={r}
                onRemove={removeReminder}
              />
            ))}
          </ul>
        </div>
      )}

      {reminderGroups.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Add a reminder
          </span>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {reminderGroups.map((group) => (
              <div key={group.character.id} className="flex flex-col gap-0.5">
                <span
                  className={`font-mono text-[10px] uppercase tracking-wider ${TEAM_TINT[group.character.team]} opacity-80`}
                >
                  {group.character.name}
                </span>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  {group.labels.map((label) => (
                    <button
                      key={label}
                      type="button"
                      className="px-2 py-0.5 rounded-full border border-base-content/15 text-base-content/65 hover:bg-base-content/5"
                      onClick={() => void addReminder(label, group.character.id)}
                    >
                      + {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={submitDraft} className="flex items-center gap-1.5 mt-auto">
        <input
          type="text"
          value={reminderDraft}
          onChange={(e) => setReminderDraft(e.target.value)}
          placeholder="custom reminder…"
          maxLength={48}
          className="flex-1 min-w-0 bg-transparent border-b border-base-content/15 text-xs px-1 py-0.5 outline-none focus:border-base-content/40"
        />
        {reminderDraft.trim() && (
          <button
            type="submit"
            className="text-[11px] px-2 py-0.5 rounded-full bg-base-content/10 hover:bg-base-content/15"
          >
            add
          </button>
        )}
      </form>
    </section>
  );
}

/**
 * Center overlay inside the ring — phase-specific controls. Sized to
 * the empty space inside the ring (radius leaves room for it).
 *
 * Variants:
 *  - night:    "Wake order" link (rail on left has the full list)
 *  - day:      nomination + vote controls (virtual) or skipped
 *              (irl — IRL day flow lives in the ring tap targets)
 *  - finished: outcome blurb (the main banner sits above the ring)
 */
function CenterControls({
  state,
  playerById,
  sendMove,
  pendingNomination,
  setPendingNomination,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  playerById: Record<string, SeatPlayer>;
  sendMove: Send;
  pendingNomination: { nominator: string | null } | null;
  setPendingNomination: (
    next: { nominator: string | null } | null,
  ) => void;
}) {
  const isNight = state.phase === "firstNight" || state.phase === "night";
  const inSetup = state.phase === "setup";
  const isFinished = state.phase === "finished";
  const isDay = state.phase === "day";

  if (inSetup || isFinished) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div
        className="surface-ivory shadow-md rounded-2xl px-4 py-3 flex flex-col items-center gap-2 pointer-events-auto z-10"
        style={{ maxWidth: 220 }}
      >
        {isNight && (
          <NightCenterControls state={state} sendMove={sendMove} />
        )}
        {isDay && state.playMode === "virtual" && (
          <DayCenterControls
            state={state}
            playerById={playerById}
            sendMove={sendMove}
            pendingNomination={pendingNomination}
            setPendingNomination={setPendingNomination}
          />
        )}
        {isDay && state.playMode === "irl" && (
          <IRLDayCenter state={state} sendMove={sendMove} />
        )}
      </div>
    </div>
  );
}

function NightCenterControls({
  state,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  sendMove: Send;
}) {
  const pool = useCharacterPool();
  const isFirstNight = state.phase === "firstNight";
  const order = useMemo(
    () => tonightOrder(state.grimoire, isFirstNight, (id) => pool[id]),
    [state.grimoire, isFirstNight, pool],
  );
  if (order.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          {isFirstNight ? "First night" : `Night ${state.dayNumber}`}
        </span>
        <span className="text-xs italic text-base-content/55">
          Nobody wakes tonight.
        </span>
      </div>
    );
  }
  const currentIndex = Math.min(state.nightStep, order.length - 1);
  const step = order[currentIndex];
  const character = step?.character ?? null;
  const advance = () =>
    sendMove({
      kind: "st.setNightStep",
      index: Math.min(currentIndex + 1, order.length - 1),
    });
  const back = () =>
    sendMove({
      kind: "st.setNightStep",
      index: Math.max(currentIndex - 1, 0),
    });

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
        {isFirstNight ? "First night" : `Night ${state.dayNumber}`} · step{" "}
        {currentIndex + 1}/{order.length}
      </span>
      <RoleToken character={character} size={56} />
      {character && (
        <span
          className={`font-display text-sm ${TEAM_TINT[character.team]}`}
        >
          {character.name}
        </span>
      )}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={back}
          disabled={currentIndex === 0}
          className="px-2 py-1 rounded-full text-xs border border-base-content/15 text-base-content/55 disabled:opacity-30"
          aria-label="Previous night step"
        >
          ←
        </button>
        <button
          type="button"
          onClick={advance}
          disabled={currentIndex >= order.length - 1}
          className="px-2 py-1 rounded-full text-xs border border-base-content/15 text-base-content/55 disabled:opacity-30"
          aria-label="Next night step"
        >
          →
        </button>
      </div>
    </div>
  );
}

function DayCenterControls({
  state,
  playerById,
  sendMove,
  pendingNomination,
  setPendingNomination,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  playerById: Record<string, SeatPlayer>;
  sendMove: Send;
  pendingNomination: { nominator: string | null } | null;
  setPendingNomination: (
    next: { nominator: string | null } | null,
  ) => void;
}) {
  const livingCount = state.seatOrder.reduce(
    (n, id) => n + (state.grimoire[id]?.isAlive ? 1 : 0),
    0,
  );
  const threshold = Math.ceil(livingCount / 2);
  const openVote = state.openVote;
  const openNom = openVote
    ? state.nominations.find((n) => n.id === openVote.nominationId)
    : undefined;

  if (openVote && openNom) {
    const yesCount = Object.values(openVote.votes).filter(
      (v) => v === "yes",
    ).length;
    const noCount = Object.values(openVote.votes).filter(
      (v) => v === "no",
    ).length;
    const isSpinning = openVote.spinPhase === "spinning";
    return (
      <SpinningVoteControls
        nominationId={openVote.nominationId}
        nominatorLabel={
          playerById[openNom.nominator]?.name ?? openNom.nominator
        }
        nomineeLabel={
          playerById[openNom.nominee]?.name ?? openNom.nominee
        }
        spinPhase={openVote.spinPhase}
        spinStartedAt={openVote.spinStartedAt}
        cadenceMs={openVote.cadenceMs}
        spinOrderLength={openVote.spinOrder.length}
        yesCount={yesCount}
        noCount={noCount}
        threshold={threshold}
        isSpinning={isSpinning}
        sendMove={sendMove}
      />
    );
  }

  if (pendingNomination) {
    return (
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Open nomination
        </span>
        <span className="text-xs text-base-content/65 leading-snug">
          {pendingNomination.nominator
            ? `${playerById[pendingNomination.nominator]?.name ?? pendingNomination.nominator} → tap nominee`
            : "Tap the nominator on the ring"}
        </span>
        <button
          type="button"
          onClick={() => setPendingNomination(null)}
          className="text-[11px] text-base-content/55 hover:text-base-content/85 underline"
        >
          cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
        Day {state.dayNumber}
      </span>
      <span className="font-mono text-[11px] text-base-content/55">
        {livingCount} alive · {threshold} to block
      </span>
      <button
        type="button"
        onClick={() => setPendingNomination({ nominator: null })}
        className="text-xs px-3 py-1 rounded-full bg-base-content/10 hover:bg-base-content/15"
      >
        Open nomination
      </button>
      <button
        type="button"
        onClick={() => void sendMove({ kind: "st.skipExecution" })}
        className="text-[11px] text-base-content/55 hover:text-base-content/85 underline"
      >
        no execution
      </button>
    </div>
  );
}

/**
 * Center panel during an open vote. Walks through:
 *   open       → "Start spin" button (after pre-commit discussion)
 *   spinning   → live tally + countdown until tally enabled
 *   spin done  → "Tally" button (writes result to nomination)
 * "Close vote" stays available throughout as a force-close (e.g. ST
 * decides to abandon or wants to tally early without waiting for
 * the visual sweep to complete).
 *
 * The `now` ticker re-renders every 100ms while spinning so the
 * countdown stays accurate without relying on server pings.
 */
function SpinningVoteControls({
  nominationId,
  nominatorLabel,
  nomineeLabel,
  spinPhase,
  spinStartedAt,
  cadenceMs,
  spinOrderLength,
  yesCount,
  noCount,
  threshold,
  isSpinning,
  sendMove,
}: {
  nominationId: string;
  nominatorLabel: string;
  nomineeLabel: string;
  spinPhase: "open" | "spinning";
  spinStartedAt: number | null;
  cadenceMs: number;
  spinOrderLength: number;
  yesCount: number;
  noCount: number;
  threshold: number;
  isSpinning: boolean;
  sendMove: Send;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isSpinning) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [isSpinning, nominationId]);

  const totalDurationMs = spinOrderLength * cadenceMs;
  const elapsed = isSpinning && spinStartedAt ? now - spinStartedAt : 0;
  const spinComplete = elapsed >= totalDurationMs;
  const remainingS = Math.max(0, Math.ceil((totalDurationMs - elapsed) / 1000));

  const startSpin = () => sendMove({ kind: "st.startSpin" });
  const closeVote = () => sendMove({ kind: "st.closeVote" });

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
        {spinPhase === "open" ? "Vote — call hands" : spinComplete ? "Vote complete" : "Spinning"}
      </span>
      <span className="font-display text-sm truncate max-w-[180px]">
        {nominatorLabel} → {nomineeLabel}
      </span>
      <span className="font-mono text-base">
        <span className="text-success">{yesCount}</span>
        {" / "}
        <span className="text-base-content/55">{noCount}</span>
        <span className="text-base-content/45 text-[10px] ml-1">
          (need {threshold})
        </span>
      </span>
      {isSpinning && !spinComplete && (
        <span className="font-mono text-[11px] text-base-content/55">
          {remainingS}s left
        </span>
      )}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {spinPhase === "open" && (
          <button
            type="button"
            onClick={() => void startSpin()}
            className="text-xs px-3 py-1 rounded-full bg-primary text-primary-content border border-primary hover:bg-primary/90"
          >
            Start spin →
          </button>
        )}
        {isSpinning && spinComplete && (
          <button
            type="button"
            onClick={() => void closeVote()}
            className="text-xs px-3 py-1 rounded-full bg-primary text-primary-content border border-primary hover:bg-primary/90"
          >
            Tally
          </button>
        )}
        <button
          type="button"
          onClick={() => void closeVote()}
          className="text-[11px] text-base-content/55 hover:text-base-content/85 underline"
        >
          {spinPhase === "open" ? "cancel vote" : "force close"}
        </button>
      </div>
    </div>
  );
}

function IRLDayCenter({
  state,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  sendMove: Send;
}) {
  const livingCount = state.seatOrder.reduce(
    (n, id) => n + (state.grimoire[id]?.isAlive ? 1 : 0),
    0,
  );
  const todayExec = state.executions.find(
    (e) => e.dayNumber === state.dayNumber,
  );
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
        Day {state.dayNumber} · IRL
      </span>
      <span className="font-mono text-[11px] text-base-content/55">
        {livingCount} alive
      </span>
      {todayExec ? (
        <span className="text-xs text-base-content/65">
          Today:{" "}
          {todayExec.executed ? (
            <strong className="font-display text-error/85">
              executed
            </strong>
          ) : (
            <em>no execution</em>
          )}
        </span>
      ) : (
        <>
          <span className="text-[11px] text-base-content/55 italic leading-snug">
            Tap a seat to execute
          </span>
          <button
            type="button"
            onClick={() => void sendMove({ kind: "st.skipExecution" })}
            className="text-[11px] text-base-content/55 hover:text-base-content/85 underline"
          >
            no execution today
          </button>
        </>
      )}
    </div>
  );
}

function CharactersMultiPicker({
  scriptCharacterIds,
  inPlayCharacterIds,
  picked,
  onToggle,
}: {
  scriptCharacterIds: readonly string[];
  inPlayCharacterIds: ReadonlySet<string>;
  picked: Set<string>;
  onToggle: (id: string) => void;
}) {
  const pool = useCharacterPool();
  // For Demon bluffs, the canonical pick is 3 not-in-play characters
  // — show those first, with the in-play ones below behind a separator
  // so the ST can still grab one if they want to bluff something
  // that's actually in play (advanced ST decision).
  const notInPlay = scriptCharacterIds.filter((id) => !inPlayCharacterIds.has(id));
  const inPlay = scriptCharacterIds.filter((id) => inPlayCharacterIds.has(id));
  const Chip = ({ id, dim }: { id: string; dim?: boolean }) => {
    const c = pool[id];
    const on = picked.has(id);
    return (
      <button
        type="button"
        onClick={() => onToggle(id)}
        className={`px-1.5 py-0.5 rounded-full border ${
          on
            ? `${TEAM_TINT[c?.team ?? "townsfolk"]} bg-base-content/8 border-base-content/30`
            : `${dim ? "opacity-50" : ""} border-base-content/15 text-base-content/55`
        }`}
      >
        {c?.name ?? id}
      </button>
    );
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-base-content/55">
        bluffs (Demon learns 3 not-in-play characters):
      </span>
      <div className="flex flex-wrap gap-1">
        {notInPlay.map((id) => (
          <Chip key={id} id={id} />
        ))}
      </div>
      {inPlay.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-base-content/45">
            in-play characters (rarely picked as bluffs)
          </summary>
          <div className="flex flex-wrap gap-1 mt-1">
            {inPlay.map((id) => (
              <Chip key={id} id={id} dim />
            ))}
          </div>
        </details>
      )}
      {picked.size > 0 && (
        <span className="text-base-content/45 italic">
          {picked.size} picked{" "}
          {picked.size > 3 && "(BotC standard is exactly 3)"}
        </span>
      )}
    </div>
  );
}

function NightOrderPanel({
  state,
  playerById,
  sendMove,
}: {
  state: Extract<BotCView, { viewer: "storyteller" }>["state"];
  playerById: Record<string, SeatPlayer>;
  sendMove: Send;
}) {
  const isFirstNight = state.phase === "firstNight";
  const pool = useCharacterPool();
  const order = useMemo(
    () => tonightOrder(state.grimoire, isFirstNight, (id) => pool[id]),
    [state.grimoire, isFirstNight, pool],
  );
  const inPlayCharacterIds = useMemo(() => {
    const set = new Set<string>();
    for (const seat of Object.values(state.grimoire)) {
      if (seat.characterId) set.add(seat.characterId);
    }
    return set;
  }, [state.grimoire]);

  if (order.length === 0) {
    return (
      <section className="surface-ivory p-4 text-sm text-base-content/60 italic">
        No characters wake tonight.
      </section>
    );
  }

  const currentIndex = Math.min(state.nightStep, order.length - 1);

  return (
    <section className="surface-ivory p-4 flex flex-col gap-2">
      <header className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg">Night order</h3>
        <span className="text-[11px] text-base-content/55 font-mono">
          step {currentIndex + 1} / {order.length}
        </span>
      </header>
      <ol className="flex flex-col gap-1">
        {order.map((step, i) => (
          <NightOrderItem
            key={step.id}
            step={step}
            index={i}
            isCurrent={i === currentIndex}
            playerById={playerById}
            scriptCharacterIds={state.scriptCharacterIds}
            inPlayCharacterIds={inPlayCharacterIds}
            onSelect={() =>
              void sendMove({ kind: "st.setNightStep", index: i })
            }
            onSendInfo={(target, info) =>
              sendMove({
                kind: "st.sendInfo",
                targetPlayerId: target,
                info,
              })
            }
          />
        ))}
      </ol>
    </section>
  );
}

function NightOrderItem({
  step,
  index,
  isCurrent,
  playerById,
  scriptCharacterIds,
  inPlayCharacterIds,
  onSelect,
  onSendInfo,
}: {
  step: NightStep;
  index: number;
  isCurrent: boolean;
  playerById: Record<string, SeatPlayer>;
  scriptCharacterIds: readonly string[];
  inPlayCharacterIds: ReadonlySet<string>;
  onSelect: () => void;
  onSendInfo: (target: string, info: SendInfoPayload) => Promise<void> | void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const seatNames = step.seatIds
    .map((id) => playerById[id]?.name ?? id)
    .join(", ");

  const openModal = () => {
    if (!isCurrent) onSelect();
    setModalOpen(true);
  };

  return (
    <li
      className={`rounded ${
        isCurrent ? "bg-primary/8" : "hover:bg-base-content/4"
      }`}
    >
      <button
        type="button"
        onClick={openModal}
        className="w-full text-left flex items-center gap-2 px-2 py-1.5 group"
      >
        <span className="font-mono text-[10px] text-base-content/45 w-5 text-right shrink-0">
          {index + 1}
        </span>
        <RoleToken character={step.character} size={28} />
        <div className="flex-1 min-w-0">
          <div
            className={`font-display text-sm leading-tight truncate ${
              isCurrent ? "text-primary" : ""
            }`}
          >
            {step.label}
          </div>
          {seatNames && (
            <div className="text-[10px] text-base-content/55 truncate leading-tight">
              {seatNames}
            </div>
          )}
        </div>
        <span className="text-[10px] text-base-content/45 group-hover:text-primary shrink-0">
          →
        </span>
      </button>
      {modalOpen && (
        <NightInfoModal
          step={step}
          playerById={playerById}
          scriptCharacterIds={scriptCharacterIds}
          inPlayCharacterIds={inPlayCharacterIds}
          onSend={(target, info) => {
            void onSendInfo(target, info);
          }}
          onClose={() => setModalOpen(false)}
        />
      )}
    </li>
  );
}

/**
 * Modal-style "send info" composer. Replaces the cramped inline form
 * that lived in the night-order rail. Has more room for picking
 * seats, characters, and free text — and gets out of the way once
 * the ST clicks Send.
 */
function NightInfoModal({
  step,
  playerById,
  scriptCharacterIds,
  inPlayCharacterIds,
  onSend,
  onClose,
}: {
  step: NightStep;
  playerById: Record<string, SeatPlayer>;
  scriptCharacterIds: readonly string[];
  inPlayCharacterIds: ReadonlySet<string>;
  onSend: (target: string, info: SendInfoPayload) => void;
  onClose: () => void;
}) {
  const pool = useCharacterPool();
  const [target, setTarget] = useState(step.seatIds[0] ?? "");
  const [text, setText] = useState("");
  const [pickedSeats, setPickedSeats] = useState<Set<string>>(new Set());
  const [characterId, setCharacterId] = useState("");
  const [pickedCharacters, setPickedCharacters] = useState<Set<string>>(
    new Set(),
  );
  const [yesNo, setYesNo] = useState<"" | "yes" | "no">("");
  const [number, setNumber] = useState<string>("");

  const buildInfo = (): SendInfoPayload | null => {
    const info: SendInfoPayload = {};
    if (text.trim()) info.text = text.trim().slice(0, 500);
    if (pickedSeats.size > 0) info.seats = Array.from(pickedSeats);
    if (characterId) info.character = characterId;
    if (pickedCharacters.size > 0)
      info.characters = Array.from(pickedCharacters);
    if (yesNo) info.yesNo = yesNo === "yes";
    if (number !== "" && Number.isFinite(Number(number))) {
      info.number = Math.max(0, Math.floor(Number(number)));
    }
    return Object.keys(info).length === 0 ? null : info;
  };

  const submit = (sendToAll: boolean) => {
    const info = buildInfo();
    if (!info) return;
    const targets = sendToAll ? step.seatIds : [target];
    for (const t of targets) {
      if (t) onSend(t, info);
    }
    onClose();
  };

  const togglePicked = (id: string) => {
    setPickedSeats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSeats = Object.keys(playerById);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="surface-ivory max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <RoleToken character={step.character} size={48} />
            <div className="min-w-0">
              <div
                className={`font-display text-lg leading-tight ${step.character ? TEAM_TINT[step.character.team] : ""}`}
              >
                {step.label}
              </div>
              {step.character?.ability && (
                <p className="text-[11px] text-base-content/65 leading-snug mt-0.5">
                  {step.character.ability}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-base-content/45 hover:text-base-content/85 text-xl leading-none -mt-0.5"
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {step.seatIds.length > 1 ? (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
              Send to
            </label>
            <div className="flex flex-wrap gap-1">
              {step.seatIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTarget(id)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${
                    target === id
                      ? "bg-primary/15 text-primary border-primary/40"
                      : "border-base-content/15 text-base-content/65 hover:bg-base-content/5"
                  }`}
                >
                  {playerById[id]?.name ?? id}
                </button>
              ))}
            </div>
          </div>
        ) : step.seatIds[0] ? (
          <div className="text-xs text-base-content/55">
            Sending to{" "}
            <strong className="font-display">
              {playerById[step.seatIds[0]]?.name ?? step.seatIds[0]}
            </strong>
          </div>
        ) : null}

        {/* Quick numeric / yes-no shortcuts */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Quick
          </span>
          {[0, 1, 2, 3].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNumber(String(n))}
              className={`w-8 h-8 rounded-full font-display text-sm border ${
                number === String(n)
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "border-base-content/15 text-base-content/65 hover:bg-base-content/5"
              }`}
            >
              {n}
            </button>
          ))}
          <span className="text-base-content/30 mx-1">·</span>
          {(["yes", "no"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setYesNo(v)}
              className={`px-3 h-8 rounded-full text-xs border ${
                yesNo === v
                  ? v === "yes"
                    ? "bg-success/15 text-success border-success/40"
                    : "bg-base-content/10 text-base-content/65 border-base-content/25"
                  : "border-base-content/15 text-base-content/55 hover:bg-base-content/5"
              }`}
            >
              {v.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Point at seat(s) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Point at seat(s)
          </span>
          <div className="flex flex-wrap gap-1 text-[11px]">
            {allSeats.map((id) => {
              const on = pickedSeats.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePicked(id)}
                  className={`px-2 py-0.5 rounded-full border ${
                    on
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-base-content/15 text-base-content/55 hover:bg-base-content/5"
                  }`}
                >
                  {playerById[id]?.name ?? id}
                </button>
              );
            })}
          </div>
        </div>

        {/* Show one character (or three for demon-info) */}
        {step.kind === "demon-info" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
              Demon bluffs
            </span>
            <CharactersMultiPicker
              scriptCharacterIds={scriptCharacterIds}
              inPlayCharacterIds={inPlayCharacterIds}
              picked={pickedCharacters}
              onToggle={(id) =>
                setPickedCharacters((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
              Show character
            </span>
            <select
              className="bg-transparent border border-base-content/15 rounded px-2 py-1 text-xs"
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
            >
              <option value="">— none —</option>
              {scriptCharacterIds.map((id) => {
                const c = pool[id];
                return (
                  <option key={id} value={id}>
                    {c?.name ?? id}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* Free-text whisper */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Note (optional)
          </label>
          <textarea
            className="bg-transparent border border-base-content/15 rounded px-2 py-1.5 text-sm resize-y min-h-[2.5rem]"
            rows={2}
            maxLength={500}
            placeholder="e.g. 'One of these is the Investigator.'"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        <footer className="flex items-center justify-end gap-2 pt-1 border-t border-base-content/10">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-full text-base-content/55 hover:bg-base-content/5"
          >
            Cancel
          </button>
          {step.seatIds.length > 1 && (
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-full bg-base-content/10 hover:bg-base-content/15"
              onClick={() => submit(true)}
            >
              Send to all ({step.seatIds.length})
            </button>
          )}
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-full bg-primary text-primary-content hover:bg-primary/90"
            onClick={() => submit(false)}
            disabled={!buildInfo()}
          >
            Send →
          </button>
        </footer>
      </div>
    </div>
  );
}

function FinalGrimoireList({
  seatOrder,
  finalGrimoire,
  playerById,
  mySeatId,
}: {
  seatOrder: readonly string[];
  finalGrimoire: Record<string, SeatGrimoire>;
  playerById: Record<string, SeatPlayer>;
  mySeatId?: string;
}) {
  const pool = useCharacterPool();
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
        Final grimoire
      </span>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
        {seatOrder.map((id) => {
          const seat = finalGrimoire[id];
          const c = seat?.characterId
            ? (pool[seat.characterId] ?? null)
            : null;
          const isMe = id === mySeatId;
          return (
            <li
              key={id}
              className={`flex items-baseline justify-between gap-2 px-2 py-1 rounded ${
                seat?.isAlive ? "" : "opacity-55"
              } ${isMe ? "bg-base-content/5" : ""}`}
            >
              <span className="font-display truncate">
                {playerById[id]?.name ?? id}
                {isMe && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-[0.18em] text-base-content/55">
                    you
                  </span>
                )}
              </span>
              <span
                className={`font-mono text-xs ${
                  c ? TEAM_TINT[c.team] : "text-base-content/40"
                }`}
              >
                {c?.name ?? "—"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FinishedBanner({
  winner,
  reason,
}: {
  winner: "good" | "evil";
  reason: string | null;
}) {
  const tint =
    winner === "good"
      ? "bg-info/15 text-info border-info/35"
      : "bg-error/15 text-error border-error/35";
  return (
    <section
      className={`p-4 rounded-md border flex flex-col gap-1 ${tint}`}
    >
      <span className="text-[10px] uppercase tracking-[0.22em] opacity-80">
        Match ended
      </span>
      <h3 className="font-display text-xl">
        {winner === "good" ? "Good wins" : "Evil wins"}
      </h3>
      {reason && <p className="text-sm opacity-90">{reason}</p>}
    </section>
  );
}

function EndMatchModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (winner: "good" | "evil", reason: string) => void;
  onCancel: () => void;
}) {
  const [winner, setWinner] = useState<"good" | "evil">("good");
  const [reason, setReason] = useState("");
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onConfirm(winner, reason.trim() || "Storyteller called the game.");
  };
  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4"
      >
        <header className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
            End match
          </span>
          <h3 className="font-display text-xl">Who wins?</h3>
        </header>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setWinner("good")}
            className={`flex-1 px-3 py-2 rounded-full border ${
              winner === "good"
                ? "bg-info/15 text-info border-info/35"
                : "border-base-content/15 text-base-content/55"
            }`}
          >
            Good wins
          </button>
          <button
            type="button"
            onClick={() => setWinner("evil")}
            className={`flex-1 px-3 py-2 rounded-full border ${
              winner === "evil"
                ? "bg-error/15 text-error border-error/35"
                : "border-base-content/15 text-base-content/55"
            }`}
          >
            Evil wins
          </button>
        </div>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="How? (e.g. 'Imp executed on day 3', 'town reduced to 2')"
          rows={2}
          maxLength={120}
          className="bg-transparent border border-base-content/15 rounded px-2 py-1 text-sm resize-y"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-full text-sm text-base-content/65 hover:bg-base-content/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary rounded-full px-5"
          >
            End match
          </button>
        </div>
      </form>
    </div>
  );
}

function FabledPanel({
  fabled,
  sendMove,
  compact = false,
}: {
  fabled: readonly string[];
  sendMove: Send;
  compact?: boolean;
}) {
  const pool = useCharacterPool();
  const [open, setOpen] = useState(false);
  const active = fabled
    .map((id) => pool[id])
    .filter((c): c is Character => Boolean(c));
  const available = FABLED_IDS.filter((id) => !fabled.includes(id));

  // Compact mode (corner overlay in the new tablet grimoire): hide
  // entirely until there's something interesting OR the ST pops it
  // open via the trigger pill.
  if (compact && active.length === 0 && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] px-2.5 py-1 rounded-full bg-base-100/70 backdrop-blur border border-base-content/15 text-base-content/55 hover:bg-base-100/90 shadow-sm"
        title="Add a Fabled character"
      >
        + Fabled
      </button>
    );
  }

  return (
    <section
      className={`surface-ivory ${compact ? "p-2 shadow-md" : "p-3"} flex flex-col gap-2`}
    >
      <header className="flex items-baseline justify-between gap-2 flex-wrap">
        <h3 className={`font-display ${compact ? "text-xs" : "text-sm"}`}>
          Fabled
        </h3>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-[11px] text-base-content/55 hover:text-base-content/85"
        >
          {open ? "close" : "+ add"}
        </button>
      </header>
      {active.length === 0 && !open && (
        <p className="text-[11px] text-base-content/45 italic">
          No Fabled active.
        </p>
      )}
      {active.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {active.map((c) => (
            <li
              key={c.id}
              className="flex items-baseline gap-2 px-2 py-1 rounded text-xs bg-secondary/8"
            >
              <span className="font-display text-secondary">{c.name}</span>
              {!compact && (
                <span className="flex-1 text-base-content/70 leading-snug">
                  {c.ability}
                </span>
              )}
              <button
                type="button"
                onClick={() =>
                  void sendMove({ kind: "st.removeFabled", fabledId: c.id })
                }
                className="text-base-content/45 hover:text-base-content/80"
                aria-label={`Remove ${c.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && available.length > 0 && (
        <div
          className={`flex flex-wrap gap-1 ${
            active.length > 0 ? "pt-1 border-t border-base-content/10" : ""
          } text-[11px] ${compact ? "max-h-40 overflow-y-auto" : ""}`}
        >
          {available.map((id) => {
            const c = pool[id];
            if (!c) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  void sendMove({ kind: "st.addFabled", fabledId: id });
                  setOpen(false);
                }}
                className="px-1.5 py-0.5 rounded-full border border-base-content/15 text-base-content/65 hover:bg-base-content/5"
                title={c.ability}
              >
                + {c.name}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}


function ReminderChip({
  reminder,
  onRemove,
}: {
  reminder: ReminderToken;
  onRemove: (id: string) => Promise<void> | void;
}) {
  return (
    <li className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-200/30 text-amber-900 dark:text-amber-200">
      <span>{reminder.label}</span>
      <button
        type="button"
        className="text-amber-900/55 dark:text-amber-200/55 hover:text-amber-900 dark:hover:text-amber-200"
        aria-label={`Remove ${reminder.label}`}
        onClick={() => void onRemove(reminder.id)}
      >
        ×
      </button>
    </li>
  );
}

function Pill({
  on,
  tint,
  onClick,
  children,
}: {
  on: boolean;
  tint: "error" | "warning" | "info";
  onClick: () => void;
  children: ReactNode;
}) {
  const onClass = {
    error: "bg-error/15 text-error border-error/30",
    warning: "bg-warning/15 text-warning border-warning/35",
    info: "bg-info/15 text-info border-info/30",
  }[tint];
  const offClass = "border-base-content/15 text-base-content/55 hover:bg-base-content/5";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${
        on ? onClass : offClass
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Display label for a script id. Built-in scripts get their canonical
 * names ("Trouble Brewing"); custom scripts pass through their stored
 * name verbatim (the server stores the script name in scriptId when a
 * customScript is active).
 */
function scriptDisplayName(scriptId: string): string {
  return SCRIPT_LABELS[scriptId as BuiltInScriptId] ?? scriptId;
}

function phaseLabel(phase: BotCPhase, dayNumber: number): string {
  switch (phase) {
    case "setup":
      return "setup";
    case "firstNight":
      return "first night";
    case "day":
      return `day ${dayNumber}`;
    case "night":
      return `night ${dayNumber}`;
    case "finished":
      return "match ended";
  }
}

function phaseAdvanceLabel(phase: BotCPhase, dayNumber: number): string | null {
  switch (phase) {
    case "setup":
      return null; // setup uses its own "Start the first night" button
    case "firstNight":
      return "Advance to day 1 →";
    case "day":
      return `Advance to night ${dayNumber} →`;
    case "night":
      return `Advance to day ${dayNumber + 1} →`;
    case "finished":
      return null;
  }
}

// ============================================================================
// Player
// ============================================================================

type PlayerTab = "me" | "seats" | "script";

interface InfoEvent {
  info: SendInfoPayload;
  sentAt: number;
  /** Auto-incrementing id for stable React keys. */
  id: number;
}

/**
 * Phone-first player surface. Three tabs:
 *   - Me: role token, status, day actions (vote UI), and the running
 *     log of every private info the ST has whispered (incl. demon
 *     bluffs, evil-team reveals, character info, etc.)
 *   - Seats: read-only town-square showing who's alive/dead. Names +
 *     alive shroud only — character identities stay hidden until the
 *     match ends and the post-mortem grimoire is revealed.
 *   - Script: every character in the active script grouped by team,
 *     for looking up other players' possible abilities.
 *
 * The PrivateInfoModal still pops the moment a new info arrives so
 * the player notices, AND that info is appended to the Me-tab log
 * so they can review it later (no more "wait, what did the ST tell
 * me on night 1?").
 */
function PlayerSurface({
  view,
  players,
  sendMove,
  onEvent,
}: {
  view: Extract<BotCView, { viewer: "player" }>;
  players: SeatPlayer[];
  sendMove: Send;
  onEvent: OnEvent;
}) {
  const pool = useCharacterPool();
  const character: Character | null = view.me?.characterId
    ? (pool[view.me.characterId] ?? null)
    : null;

  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );

  const [pending, setPending] = useState<SendInfoPayload | null>(null);
  const [infoLog, setInfoLog] = useState<InfoEvent[]>([]);
  const [tab, setTab] = useState<PlayerTab>("me");
  const infoIdRef = useRef(0);

  useEffect(() => {
    return onEvent((e) => {
      if (e.kind !== "botc.privateInfo") return;
      const payload = e.payload as
        | { info?: SendInfoPayload; sentAt?: number }
        | undefined;
      if (!payload?.info) return;
      setPending(payload.info);
      infoIdRef.current += 1;
      setInfoLog((prev) => [
        ...prev,
        {
          info: payload.info!,
          sentAt: payload.sentAt ?? Date.now(),
          id: infoIdRef.current,
        },
      ]);
    });
  }, [onEvent]);

  const dismissPending = () => {
    setPending(null);
    void sendMove({ kind: "p.acknowledgeWake" });
  };

  const isFinished = view.phase === "finished";

  return (
    <div className="surface-ivory w-full max-w-md flex flex-col gap-3 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          {scriptDisplayName(view.scriptId)} ·{" "}
          {view.phase === "setup"
            ? "setup"
            : phaseLabel(view.phase, view.dayNumber)}
          {view.me && !view.me.isAlive ? " · ghost" : ""}
        </span>
        <h2 className="font-display text-2xl tracking-tight">
          {view.me ? "Your seat" : "Watching"}
        </h2>
      </header>

      {/* Tabs — only visible once the match is in progress. During setup
          there's nothing else to look at. */}
      {view.phase !== "setup" && (
        <nav
          role="tablist"
          aria-label="Player view"
          className="flex gap-1 -mt-1 border-b border-base-content/10"
        >
          {(
            [
              { id: "me" as const, label: "You" },
              { id: "seats" as const, label: "Seats" },
              { id: "script" as const, label: "Script" },
            ]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-display border-b-2 -mb-[1px] transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-base-content/55 hover:text-base-content/85"
              }`}
            >
              {t.label}
            </button>
          ))}
          {infoLog.length > 0 && tab !== "me" && (
            <span className="ml-auto self-center text-[10px] text-base-content/45 font-mono pr-1">
              {infoLog.length} note{infoLog.length === 1 ? "" : "s"}
            </span>
          )}
        </nav>
      )}

      {view.phase === "setup" && (
        <p className="text-sm text-base-content/65 leading-relaxed">
          The Storyteller is distributing characters. Sit tight — your role
          will appear here when setup is done.
        </p>
      )}

      {view.phase !== "setup" && tab === "me" && (
        <PlayerMeView
          view={view}
          character={character}
          playerById={playerById}
          infoLog={infoLog}
          sendMove={sendMove}
        />
      )}

      {view.phase !== "setup" && tab === "seats" && (
        <PlayerSeatChart view={view} playerById={playerById} />
      )}

      {view.phase !== "setup" && tab === "script" && (
        <PlayerScriptView scriptCharacterIds={view.scriptCharacterIds} />
      )}

      {isFinished && view.winner && (
        <FinishedBanner winner={view.winner} reason={view.endReason} />
      )}
      {isFinished && view.finalGrimoire && (
        <FinalGrimoireList
          seatOrder={view.seatOrder}
          finalGrimoire={view.finalGrimoire}
          playerById={playerById}
          mySeatId={view.me?.seatId}
        />
      )}

      {pending && (
        <PrivateInfoModal
          info={pending}
          playerById={playerById}
          onDismiss={dismissPending}
        />
      )}
    </div>
  );
}

/** "You" tab: role, status, day actions, info log. */
function PlayerMeView({
  view,
  character,
  playerById,
  infoLog,
  sendMove,
}: {
  view: Extract<BotCView, { viewer: "player" }>;
  character: Character | null;
  playerById: Record<string, SeatPlayer>;
  infoLog: InfoEvent[];
  sendMove: Send;
}) {
  return (
    <div className="flex flex-col gap-4">
      {character ? (
        <div className="flex gap-3 items-start">
          <RoleToken
            character={character}
            size={88}
            dead={view.me ? !view.me.isAlive : false}
          />
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <span
              className={`text-[10px] uppercase tracking-[0.22em] ${TEAM_TINT[character.team]}`}
            >
              {TEAM_LABEL[character.team].slice(0, -1)}
            </span>
            <div className="font-display text-2xl leading-tight tracking-tight">
              {character.name}
            </div>
            <p className="text-sm text-base-content/75 leading-snug">
              {character.ability}
            </p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-base-content/65 italic">
          The Storyteller hasn't shown you a character yet.
        </p>
      )}

      {view.phase === "day" && view.me && view.playMode === "virtual" && (
        <DayActions
          me={view.me}
          seatOrder={view.seatOrder}
          seats={view.seats}
          nominations={view.nominations}
          openVote={view.openVote}
          playerById={playerById}
          sendMove={sendMove}
        />
      )}
      {view.phase === "day" && view.me && view.playMode === "irl" && (
        <div className="pt-3 border-t border-base-content/10 text-sm text-base-content/65 leading-relaxed">
          <span className="block text-[10px] uppercase tracking-[0.18em] text-base-content/55 mb-1">
            In-person play
          </span>
          Nominations and votes are happening at the table — your hand is
          your ballot. The Storyteller is recording outcomes here.
        </div>
      )}

      <PlayerInfoLog infoLog={infoLog} playerById={playerById} />
    </div>
  );
}

/** "Seats" tab: read-only town-square ring. */
function PlayerSeatChart({
  view,
  playerById,
}: {
  view: Extract<BotCView, { viewer: "player" }>;
  playerById: Record<string, SeatPlayer>;
}) {
  const n = view.seatOrder.length;
  if (n === 0) {
    return (
      <p className="text-sm text-base-content/55 italic">No seats yet.</p>
    );
  }
  // Phone-first compact ring geometry: 320–400 wide tablets/phones.
  const tokenSize =
    n <= 6 ? 64 : n <= 9 ? 56 : n <= 11 ? 50 : n <= 13 ? 44 : 40;
  const minGap = tokenSize * 1.18;
  const radius = Math.max(108, minGap / (2 * Math.sin(Math.PI / n)));
  const labelPadding = 28;
  const containerSize = (radius + tokenSize / 2) * 2 + labelPadding;

  const livingCount = view.seatOrder.reduce(
    (acc, id) => acc + (view.seats[id]?.isAlive ? 1 : 0),
    0,
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55 self-start">
        {livingCount} of {n} alive
      </span>
      <div
        className="relative flex-none"
        style={{
          width: containerSize,
          height: containerSize,
          maxWidth: "100%",
        }}
      >
        {view.seatOrder.map((seatId, i) => {
          const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const seatPub = view.seats[seatId];
          const isMe = view.me?.seatId === seatId;
          const playerName = playerById[seatId]?.name ?? seatId;
          return (
            <div
              key={seatId}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                width: tokenSize + 14,
              }}
              className="flex flex-col items-center gap-0.5"
              aria-label={`${playerName}${seatPub?.isAlive ? "" : " (dead)"}`}
            >
              <span
                className={`relative rounded-full ${
                  isMe ? "ring-2 ring-primary shadow" : ""
                }`}
              >
                <RoleToken
                  character={null}
                  size={tokenSize}
                  dead={!seatPub?.isAlive}
                />
              </span>
              <span
                className={`font-display text-[10px] text-center truncate w-full leading-tight ${
                  isMe ? "text-primary" : "text-base-content/85"
                }`}
              >
                {playerName}
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-base-content/50 italic text-center max-w-[280px]">
        Roles stay hidden until the game ends.
      </p>
    </div>
  );
}

/** "Script" tab: every character in the active script, grouped by team. */
function PlayerScriptView({
  scriptCharacterIds,
}: {
  scriptCharacterIds: readonly string[];
}) {
  const pool = useCharacterPool();
  const groups = useMemo(() => {
    const teams: CharacterTeam[] = [
      "townsfolk",
      "outsider",
      "minion",
      "demon",
      "traveller",
      "fabled",
    ];
    const byTeam: Record<CharacterTeam, Character[]> = {
      townsfolk: [],
      outsider: [],
      minion: [],
      demon: [],
      traveller: [],
      fabled: [],
    };
    for (const id of scriptCharacterIds) {
      const c = pool[id];
      if (c) byTeam[c.team].push(c);
    }
    return teams
      .filter((t) => byTeam[t].length > 0)
      .map((t) => ({ team: t, chars: byTeam[t] }));
  }, [scriptCharacterIds, pool]);

  return (
    <div className="flex flex-col gap-3">
      {groups.map(({ team, chars }) => (
        <section key={team} className="flex flex-col gap-1.5">
          <h3
            className={`font-display text-xs uppercase tracking-[0.22em] ${TEAM_TINT[team]}`}
          >
            {TEAM_LABEL[team]}
          </h3>
          <ul className="flex flex-col gap-1.5">
            {chars.map((c) => (
              <li key={c.id} className="flex gap-2.5 items-start">
                <RoleToken character={c} size={36} />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="font-display text-sm leading-tight">
                    {c.name}
                  </span>
                  <p className="text-[11px] text-base-content/65 leading-snug">
                    {c.ability}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Running log of private info the ST has whispered to this player. */
function PlayerInfoLog({
  infoLog,
  playerById,
}: {
  infoLog: readonly InfoEvent[];
  playerById: Record<string, SeatPlayer>;
}) {
  const pool = useCharacterPool();
  if (infoLog.length === 0) {
    return (
      <div className="flex flex-col gap-1 pt-3 border-t border-base-content/10">
        <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
          From the Storyteller
        </span>
        <p className="text-xs text-base-content/55 italic">
          Nothing yet. The Storyteller will whisper as your character wakes.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 pt-3 border-t border-base-content/10">
      <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
        From the Storyteller — {infoLog.length} note
        {infoLog.length === 1 ? "" : "s"}
      </span>
      <ul className="flex flex-col gap-2">
        {[...infoLog].reverse().map((evt) => (
          <InfoLogEntry
            key={evt.id}
            info={evt.info}
            sentAt={evt.sentAt}
            playerById={playerById}
            pool={pool}
          />
        ))}
      </ul>
    </div>
  );
}

function InfoLogEntry({
  info,
  sentAt,
  playerById,
  pool,
}: {
  info: SendInfoPayload;
  sentAt: number;
  playerById: Record<string, SeatPlayer>;
  pool: Record<string, Character>;
}) {
  const time = useMemo(() => {
    const d = new Date(sentAt);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }, [sentAt]);
  const character = info.character ? (pool[info.character] ?? null) : null;
  const characters = info.characters
    ? info.characters
        .map((id) => pool[id])
        .filter((c): c is Character => Boolean(c))
    : [];
  return (
    <li className="surface-ivory bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/40 rounded-lg p-2.5 flex flex-col gap-1.5">
      <span className="text-[10px] font-mono text-base-content/45">{time}</span>
      {info.text && (
        <p className="text-sm text-base-content/85 leading-snug">
          {info.text}
        </p>
      )}
      {info.seats && info.seats.length > 0 && (
        <div className="flex flex-wrap gap-1 text-[11px]">
          {info.seats.map((id) => (
            <span
              key={id}
              className="px-1.5 py-0.5 rounded-full bg-base-content/10 font-display"
            >
              {playerById[id]?.name ?? id}
            </span>
          ))}
        </div>
      )}
      {character && (
        <div className="flex items-center gap-2">
          <RoleToken character={character} size={32} />
          <span
            className={`font-display text-sm ${TEAM_TINT[character.team]}`}
          >
            {character.name}
          </span>
        </div>
      )}
      {characters.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            {characters.length === 3 ? "Bluffs" : "Characters"}
          </span>
          <div className="flex flex-wrap gap-2">
            {characters.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <RoleToken character={c} size={28} />
                <span
                  className={`font-display text-xs ${TEAM_TINT[c.team]}`}
                >
                  {c.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {info.yesNo !== undefined && (
        <span className="font-display text-base">
          {info.yesNo ? "Yes" : "No"}
        </span>
      )}
      {info.number !== undefined && (
        <span className="font-display text-base font-mono">{info.number}</span>
      )}
    </li>
  );
}

function DayActions({
  me,
  seatOrder,
  seats,
  nominations,
  openVote,
  playerById,
  sendMove,
}: {
  me: NonNullable<Extract<BotCView, { viewer: "player" }>["me"]>;
  seatOrder: Extract<BotCView, { viewer: "player" }>["seatOrder"];
  seats: Extract<BotCView, { viewer: "player" }>["seats"];
  nominations: Extract<BotCView, { viewer: "player" }>["nominations"];
  openVote: Extract<BotCView, { viewer: "player" }>["openVote"];
  playerById: Record<string, SeatPlayer>;
  sendMove: Send;
}) {
  const [nominee, setNominee] = useState("");
  const alreadyNominated = nominations.some((n) => n.nominator === me.seatId);
  const myVote = openVote?.votes[me.seatId];
  const canVote = me.isAlive || !me.ghostVoteUsed;
  const openNominee = openVote
    ? nominations.find((n) => n.id === openVote.nominationId)?.nominee
    : undefined;

  // Re-render every 100ms while spinning so the "locked" state for
  // this seat updates the moment the hand passes.
  const isSpinning =
    openVote?.spinPhase === "spinning" && openVote.spinStartedAt !== null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isSpinning) return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [isSpinning, openVote?.nominationId]);

  // Has the spinning hand passed me?
  let mySeatLocked = false;
  if (openVote && isSpinning && openVote.spinStartedAt !== null) {
    const elapsed = now - openVote.spinStartedAt;
    const lockedCount = Math.max(
      0,
      Math.min(
        openVote.spinOrder.length,
        Math.floor(elapsed / openVote.cadenceMs),
      ),
    );
    const myIdx = openVote.spinOrder.indexOf(me.seatId);
    mySeatLocked = myIdx >= 0 && myIdx < lockedCount;
  }
  const canChange = openVote && canVote && !mySeatLocked;

  const eligibleNominees = seatOrder.filter(
    (id) =>
      id !== me.seatId &&
      !nominations.some((n) => n.nominee === id) &&
      seats[id]?.isAlive,
  );

  const submitNominate = () => {
    if (!nominee) return;
    void sendMove({ kind: "p.nominate", nominee });
    setNominee("");
  };

  const cast = (vote: "yes" | "no") => {
    if (!openVote || !canChange) return;
    void sendMove({
      kind: "p.castVote",
      nominationId: openVote.nominationId,
      vote,
    });
  };

  return (
    <div className="flex flex-col gap-3 pt-3 border-t border-base-content/10">
      {openVote && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Vote on{" "}
            {openNominee
              ? (playerById[openNominee]?.name ?? openNominee)
              : "—"}
            <span className="ml-2 font-mono text-base-content/45 normal-case tracking-normal">
              {openVote.votedCount} voted
            </span>
            {openVote.spinPhase === "spinning" && (
              <span className="ml-2 text-primary normal-case tracking-normal">
                {mySeatLocked ? "· locked" : "· hand approaching"}
              </span>
            )}
          </span>
          {!canVote ? (
            <span className="text-xs text-base-content/55 italic">
              Your ghost vote is spent.
            </span>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!canChange}
                  className={`btn btn-sm rounded-full px-4 border ${
                    myVote === "yes"
                      ? "bg-success text-success-content border-success"
                      : "bg-success/15 text-success border-success/40"
                  } ${!canChange ? "opacity-60 cursor-default" : ""}`}
                  onClick={() => cast("yes")}
                >
                  ✋ Yes
                </button>
                <button
                  type="button"
                  disabled={!canChange}
                  className={`btn btn-sm rounded-full px-4 border ${
                    myVote === "no"
                      ? "bg-base-content/30 text-base-100 border-base-content/40"
                      : "bg-base-content/10 text-base-content/70 border-base-content/20"
                  } ${!canChange ? "opacity-60 cursor-default" : ""}`}
                  onClick={() => cast("no")}
                >
                  No
                </button>
              </div>
              {canChange && openVote.spinPhase === "open" && (
                <span className="text-[11px] text-base-content/55 italic">
                  You can change your vote until the hand reaches you.
                </span>
              )}
              {canChange && openVote.spinPhase === "spinning" && (
                <span className="text-[11px] text-warning">
                  Hand is sweeping — lock in your vote.
                </span>
              )}
              {!canChange && mySeatLocked && (
                <span className="text-[11px] text-base-content/55 italic">
                  Hand passed — your vote is locked as{" "}
                  <strong className="font-display">{myVote ?? "no"}</strong>.
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {!openVote && me.isAlive && !alreadyNominated && (
        <div className="flex items-center gap-2">
          <select
            value={nominee}
            onChange={(e) => setNominee(e.target.value)}
            className="flex-1 bg-transparent border-b border-base-content/15 text-sm px-1 py-0.5"
          >
            <option value="">— nominate someone —</option>
            {eligibleNominees.map((id) => (
              <option key={id} value={id}>
                {playerById[id]?.name ?? id}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!nominee}
            onClick={submitNominate}
            className="text-xs px-3 py-1 rounded-full bg-primary/15 text-primary disabled:opacity-40"
          >
            Nominate
          </button>
        </div>
      )}

      {!openVote && me.isAlive && alreadyNominated && (
        <span className="text-xs text-base-content/55 italic">
          You've already nominated today.
        </span>
      )}

      {nominations.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
            Today's nominations
          </span>
          <ul className="flex flex-col gap-0.5 text-xs">
            {nominations.map((n) => (
              <li key={n.id} className="flex items-baseline gap-1.5">
                <span className="font-display">
                  {playerById[n.nominator]?.name ?? n.nominator}
                </span>
                <span className="text-base-content/55">→</span>
                <span className="font-display">
                  {playerById[n.nominee]?.name ?? n.nominee}
                </span>
                {n.result && (
                  <span className="text-base-content/55">
                    · {n.result.yesCount} yes
                    {n.result.onTheBlock && " (block)"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PrivateInfoModal({
  info,
  playerById,
  onDismiss,
}: {
  info: SendInfoPayload;
  playerById: Record<string, SeatPlayer>;
  onDismiss: () => void;
}) {
  const pool = useCharacterPool();
  const character = info.character
    ? pool[info.character] ?? null
    : null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-4"
      onClick={onDismiss}
    >
      <div
        className="surface-ivory p-6 max-w-md w-full flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
            The Storyteller wakes you…
          </span>
          <h3 className="font-display text-xl">A whisper in the night</h3>
        </header>
        {info.text && (
          <p className="text-sm text-base-content/85 leading-relaxed whitespace-pre-wrap">
            {info.text}
          </p>
        )}
        {info.seats && info.seats.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
              Players
            </span>
            <ul className="flex flex-wrap gap-1.5">
              {info.seats.map((id) => (
                <li
                  key={id}
                  className="px-2 py-0.5 rounded-full bg-base-content/8 text-sm font-display"
                >
                  {playerById[id]?.name ?? id}
                </li>
              ))}
            </ul>
          </div>
        )}
        {character && (
          <div className="flex flex-col gap-1 border-l-2 border-primary/60 pl-3">
            <span
              className={`text-[10px] uppercase tracking-[0.18em] ${TEAM_TINT[character.team]}`}
            >
              {TEAM_LABEL[character.team].slice(0, -1)}
            </span>
            <span className="font-display text-lg">{character.name}</span>
          </div>
        )}
        {info.characters && info.characters.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
              {info.characters.length === 3 ? "Your bluffs" : "Characters"}
            </span>
            <ul className="flex flex-wrap gap-1.5">
              {info.characters.map((id) => {
                const c = pool[id];
                return (
                  <li
                    key={id}
                    className={`px-2 py-0.5 rounded-full bg-base-content/8 text-sm font-display ${
                      c ? TEAM_TINT[c.team] : ""
                    }`}
                  >
                    {c?.name ?? id}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {info.yesNo !== undefined && (
          <div className="text-sm">
            Answer:{" "}
            <strong className="font-display text-lg">
              {info.yesNo ? "Yes" : "No"}
            </strong>
          </div>
        )}
        {info.number !== undefined && (
          <div className="text-sm">
            Number:{" "}
            <strong className="font-display text-lg">{info.number}</strong>
          </div>
        )}
        <button
          type="button"
          className="btn btn-primary self-end rounded-full px-5"
          onClick={onDismiss}
        >
          Got it
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Spectator
// ============================================================================

function SpectatorPlaceholder({
  view,
  players,
}: {
  view: Extract<BotCView, { viewer: "spectator" }>;
  players: SeatPlayer[];
}) {
  const playerById = useMemo(
    () => Object.fromEntries(players.map((p) => [p.id, p])),
    [players],
  );
  const isFinished = view.phase === "finished";
  return (
    <div className="surface-ivory p-6 max-w-2xl w-full flex flex-col gap-4">
      <header className="flex flex-col gap-1">
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          Spectating · {phaseLabel(view.phase, view.dayNumber)}
        </span>
        <h2 className="font-display text-2xl tracking-tight">Town square</h2>
      </header>
      {!isFinished && (
        <p className="text-sm text-base-content/65 leading-relaxed">
          Roles and Grimoire reveal at the end of the match.
        </p>
      )}
      {isFinished && view.winner && (
        <FinishedBanner winner={view.winner} reason={view.endReason} />
      )}
      {isFinished && view.finalGrimoire && (
        <FinalGrimoireList
          seatOrder={view.seatOrder}
          finalGrimoire={view.finalGrimoire}
          playerById={playerById}
        />
      )}
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function countByTeam(
  assignments: Record<string, string | null>,
  scriptCharacters: Character[],
): Record<CharacterTeam, number> {
  const counts: Record<CharacterTeam, number> = {
    townsfolk: 0,
    outsider: 0,
    minion: 0,
    demon: 0,
    traveller: 0,
    fabled: 0,
  };
  const byId = Object.fromEntries(scriptCharacters.map((c) => [c.id, c]));
  for (const cid of Object.values(assignments)) {
    if (!cid) continue;
    const c = byId[cid];
    if (!c) continue;
    counts[c.team]++;
  }
  return counts;
}

function countAssigned(d: Record<string, string | null>): number {
  return Object.values(d).filter(Boolean).length;
}

function filterAssignments(
  d: Record<string, string | null>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(d).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  );
}

/**
 * Setup-modifying characters: when included in the picked set, they
 * shift the official distribution by the listed delta. Townsfolk delta
 * is computed implicitly so the total stays at the intended count.
 *
 * Drunk and Godfather are flagged `setup: true` in the canonical data
 * but don't change the count (Drunk replaces a townsfolk, Godfather is
 * just a setup task) — only count-modifiers go here.
 */
const SETUP_MODIFIERS: Readonly<Record<string, { outsider: number }>> = {
  baron: { outsider: +2 }, // also -2 townsfolk
  fanggu: { outsider: +1 }, // also -1 townsfolk
  vigormortis: { outsider: -1 }, // also +1 townsfolk
};

/**
 * Pick a balanced character distribution for the given player count.
 * Works for any of our base scripts (TB / BMR / S&V) — the distribution
 * table is the same across editions, but each script supplies a
 * different character pool.
 *
 * If a picked Minion or Demon is in SETUP_MODIFIERS, the
 * Townsfolk/Outsider counts are shifted accordingly so the total still
 * equals playerCount. Returns null when the pool is too thin to
 * satisfy the recommended split (caller should fall back to manual).
 */
function pickBalanced(
  scriptCharacters: Character[],
  playerCount: number,
): Character[] | null {
  const recommended = TB_DISTRIBUTION[playerCount];
  if (!recommended) return null;
  let [t, o, m, d] = recommended;
  const byTeam = (team: CharacterTeam) =>
    scriptCharacters.filter((c) => c.team === team);
  const minions = pickRandom(byTeam("minion"), m);
  const demons = pickRandom(byTeam("demon"), d);
  if (minions.length < m || demons.length < d) return null;
  for (const c of [...minions, ...demons]) {
    const mod = SETUP_MODIFIERS[c.id];
    if (mod) {
      o = Math.max(0, o + mod.outsider);
      t = Math.max(0, t - mod.outsider);
    }
  }
  const townsfolk = pickRandom(byTeam("townsfolk"), t);
  const outsiders = pickRandom(byTeam("outsider"), o);
  if (townsfolk.length < t || outsiders.length < o) return null;
  return [...townsfolk, ...outsiders, ...minions, ...demons];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  if (n <= 0 || arr.length === 0) return [];
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]!);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function BotCLobbyPanel({
  config,
  isHost,
  onChange,
}: LobbyPanelProps<BotCConfig>) {
  const scriptId = (config?.scriptId as BuiltInScriptId) ?? "trouble-brewing";
  const customScript = config?.customScript;
  const playMode = (config?.playMode as "irl" | "virtual") ?? "virtual";
  const [showPaste, setShowPaste] = useState(false);
  const [paste, setPaste] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  const baseConfig = (): BotCConfig => {
    const existing = config ?? {};
    return {
      scriptId: existing.scriptId ?? "trouble-brewing",
      playMode: existing.playMode ?? "virtual",
      ...(existing.customScript ? { customScript: existing.customScript } : {}),
    };
  };

  const pickBuiltIn = (id: BuiltInScriptId) => {
    onChange({ ...baseConfig(), scriptId: id, customScript: undefined });
  };

  const pickPlayMode = (mode: "irl" | "virtual") => {
    onChange({ ...baseConfig(), playMode: mode });
  };

  const submitCustom = () => {
    const result = parseScriptJson(paste);
    if ("error" in result) {
      setParseError(result.error);
      return;
    }
    onChange({ ...baseConfig(), customScript: result.script });
    setParseError(null);
    setShowPaste(false);
    setPaste("");
  };

  const clearCustom = () => {
    onChange({ ...baseConfig(), customScript: undefined });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          How are you playing?
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              {
                id: "virtual" as const,
                label: "Virtual",
                hint: "Voice + app voting",
              },
              {
                id: "irl" as const,
                label: "In person",
                hint: "App is just the Grimoire",
              },
            ]
          ).map((mode) => {
            const active = playMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                disabled={!isHost}
                onClick={() => pickPlayMode(mode.id)}
                className={`flex flex-col items-start gap-0.5 px-3 py-2 rounded-lg text-sm border ${
                  active
                    ? "bg-primary/15 text-primary border-primary/40"
                    : "border-base-content/15 text-base-content/65 hover:bg-base-content/5"
                } ${!isHost ? "opacity-60 cursor-default" : ""}`}
              >
                <span className="font-display">{mode.label}</span>
                <span className="text-[10px] text-base-content/55 normal-case">
                  {mode.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="text-sm text-base-content/65">
        {isHost
          ? "Pick the edition you'll Storytell. You can change this until the match starts."
          : "Storyteller is choosing the edition."}
      </div>
      <div className="flex flex-wrap gap-2">
        {BUILT_IN_SCRIPT_IDS.map((id) => {
          const active = !customScript && scriptId === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!isHost}
              onClick={() => pickBuiltIn(id)}
              className={`px-3 py-1.5 rounded-full text-sm border ${
                active
                  ? "bg-primary/15 text-primary border-primary/40"
                  : "border-base-content/15 text-base-content/65 hover:bg-base-content/5"
              } ${!isHost ? "opacity-60" : ""}`}
            >
              {SCRIPT_LABELS[id]}
            </button>
          );
        })}
        {customScript ? (
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm border bg-primary/15 text-primary border-primary/40"
            title={`${customScript.characterIds.length} characters`}
          >
            {customScript.name}
            {isHost && (
              <button
                type="button"
                onClick={clearCustom}
                className="text-primary/60 hover:text-primary"
                aria-label="Clear custom script"
              >
                ×
              </button>
            )}
          </span>
        ) : (
          isHost && (
            <button
              type="button"
              onClick={() => setShowPaste((s) => !s)}
              className="px-3 py-1.5 rounded-full text-sm border border-dashed border-base-content/25 text-base-content/55 hover:bg-base-content/5"
            >
              {showPaste ? "Cancel" : "+ Paste custom script…"}
            </button>
          )
        )}
      </div>
      {showPaste && isHost && !customScript && (
        <div className="flex flex-col gap-2">
          <textarea
            className="bg-base-100/60 border border-base-content/15 rounded px-3 py-2 text-xs font-mono min-h-[120px] resize-y"
            placeholder='Paste a script JSON, e.g. [{"id":"_meta","name":"My Script"},"washerwoman","empath",...]'
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setParseError(null);
            }}
          />
          {parseError && (
            <p className="text-xs text-error">{parseError}</p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPaste(false);
                setPaste("");
                setParseError(null);
              }}
              className="text-xs px-3 py-1.5 rounded-full text-base-content/55 hover:bg-base-content/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!paste.trim()}
              onClick={submitCustom}
              className="text-xs px-3 py-1.5 rounded-full bg-primary/15 text-primary disabled:opacity-40"
            >
              Use this script
            </button>
          </div>
          <p className="text-[11px] text-base-content/45 italic">
            Accepts the canonical Pandemonium Institute script JSON
            format. Characters can be id-references to anything in
            Trouble Brewing, Bad Moon Rising, Sects & Violets, or Fabled,
            or full inline definitions for homebrew characters.
          </p>
        </div>
      )}
    </div>
  );
}

export const bloodClocktowerClientModule: ClientGameModule<
  BotCView,
  BotCMove,
  BotCConfig
> = {
  type: BOTC_TYPE,
  Board: BotCBoard,
  LobbyPanel: BotCLobbyPanel,
};
