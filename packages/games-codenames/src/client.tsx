import { useState } from "react";
import type {
  BoardProps,
  ClientGameModule,
  LobbyPanelProps,
  SummaryProps,
} from "@bgo/sdk-client";
import {
  CODENAMES_TYPE,
  GRID_COLS,
  type CodenamesConfig,
  type CodenamesMove,
  type CodenamesView,
  type CardRole,
  type Team,
} from "./shared";

function cardFill(role: CardRole | null | undefined, revealed: boolean): string {
  if (!revealed && role == null) return "var(--color-base-100)";
  if (role === "red") return "var(--color-error)";
  if (role === "blue") return "var(--color-info)";
  if (role === "neutral")
    return "color-mix(in oklch, var(--color-base-300) 90%, transparent)";
  // Revealed assassin is near-ink — higher drama than warm graphite.
  if (role === "assassin") return "oklch(15% 0.005 60)";
  return "var(--color-base-100)";
}

function cardText(role: CardRole | null | undefined, revealed: boolean): string {
  if (!revealed && role == null) return "var(--color-base-content)";
  if (role === "red") return "var(--color-error-content)";
  if (role === "blue") return "var(--color-info-content)";
  if (role === "assassin") return "color-mix(in oklch, white 92%, transparent)";
  return "var(--color-base-content)";
}

// For the spymaster pre-reveal view: a colored top stripe + dot cue instead
// of a full flood, so the word stays readable on an ivory card.
function cueStripe(role: CardRole): string {
  switch (role) {
    case "red":
      return "var(--color-error)";
    case "blue":
      return "var(--color-info)";
    case "assassin":
      return "oklch(15% 0.005 60)";
    case "neutral":
      return "color-mix(in oklch, var(--color-base-content) 25%, transparent)";
  }
}

function wordSizeClass(word: string): string {
  const n = word.length;
  if (n >= 10) return "text-[11px] md:text-[13px]";
  if (n >= 8) return "text-xs md:text-sm";
  return "text-sm md:text-base";
}

const CODENAMES_KEYFRAMES = `
@keyframes codenames-assassin-shake {
  0%, 100% { transform: translateX(0); }
  15%      { transform: translateX(-2px); }
  30%      { transform: translateX(2px); }
  45%      { transform: translateX(-2px); }
  60%      { transform: translateX(2px); }
  75%      { transform: translateX(-1px); }
  90%      { transform: translateX(1px); }
}
.codenames-assassin-shake {
  animation: codenames-assassin-shake 320ms cubic-bezier(0.22, 1, 0.36, 1) both;
}
@media (prefers-reduced-motion: reduce) {
  .codenames-assassin-shake { animation: none; }
}
`;

function CodenamesBoard({
  view,
  me,
  isMyTurn,
  sendMove,
  players,
}: BoardProps<CodenamesView, CodenamesMove>) {
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState<number>(1);

  const myTeam = view.viewerTeam;
  const myRole = view.viewerRole;
  const amSpymaster = myRole === "spymaster";
  const isGuessing = view.phase === "guessing";
  const isCluing = view.phase === "cluing";
  const isOver = view.phase === "gameOver";

  const submitClue = async () => {
    const w = clueWord.trim();
    if (!w) return;
    await sendMove({ kind: "giveClue", word: w, count: clueCount });
    setClueWord("");
    setClueCount(1);
  };

  const guess = async (cardIndex: number) => {
    if (!isMyTurn || amSpymaster || !isGuessing) return;
    await sendMove({ kind: "guess", cardIndex });
  };

  const endGuessing = async () => {
    if (!isMyTurn || amSpymaster || !isGuessing) return;
    await sendMove({ kind: "endGuessing" });
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <style>{CODENAMES_KEYFRAMES}</style>
      <TurnIndicator view={view} />

      <div className="flex items-center gap-4 md:gap-6 text-sm">
        <div
          className={[
            "text-xs uppercase tracking-[0.18em] font-semibold",
            myTeam === "red"
              ? "text-error"
              : myTeam === "blue"
                ? "text-info"
                : "text-base-content/50",
          ].join(" ")}
        >
          {myTeam ? `${myTeam} team` : "observer"}
          {myRole === "spymaster" ? " · spymaster" : " · operative"}
        </div>
        <div className="h-4 w-px bg-base-300" aria-hidden />
        <ScoreDot color="var(--color-error)" label="Red" value={view.remaining.red} />
        <ScoreDot color="var(--color-info)" label="Blue" value={view.remaining.blue} />
      </div>

      <div
        className="grid gap-1.5 md:gap-2 w-full max-w-3xl"
        style={{ gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))` }}
      >
        {view.grid.map((card, i) => {
          const clickable =
            !isOver && isMyTurn && !amSpymaster && isGuessing && !card.revealed;
          // Pre-reveal, the spymaster sees a subtle cue (top stripe) instead
          // of a full flood. Post-reveal, everyone sees the full flood.
          const spymasterCue =
            amSpymaster && !card.revealed && card.role != null;
          const revealedRole = card.revealed ? card.role : null;
          const bg = cardFill(revealedRole, card.revealed);
          const fg = cardText(revealedRole, card.revealed);
          const isAssassinRevealed = card.revealed && card.role === "assassin";
          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => guess(i)}
              lang="en"
              className={[
                "relative min-h-[72px] md:min-h-[82px] px-2 py-2.5 rounded-lg",
                "text-center transition-all duration-200",
                "border border-base-300/70",
                "font-display tracking-tight",
                "flex items-center justify-center",
                clickable ? "hover:-translate-y-0.5 cursor-pointer" : "",
                card.revealed ? "parlor-fade" : "",
                isAssassinRevealed ? "codenames-assassin-shake" : "",
              ].join(" ")}
              style={{
                background: bg,
                color: fg,
                boxShadow: card.revealed
                  ? isAssassinRevealed
                    ? "inset 0 1px 0 oklch(100% 0 0 / 0.18), 0 0 0 2px color-mix(in oklch, var(--color-error) 65%, transparent), 0 0 18px color-mix(in oklch, var(--color-error) 35%, transparent)"
                    : "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -2px 0 oklch(0% 0 0 / 0.15)"
                  : "inset 0 1px 0 oklch(100% 0 0 / 0.15), 0 1px 2px oklch(0% 0 0 / 0.06)",
              }}
              aria-label={card.word}
            >
              {spymasterCue && card.role && (
                <>
                  {/* Top stripe — 5px colored band on ivory card. */}
                  <span
                    aria-hidden
                    className="absolute top-0 inset-x-0 h-1.5 rounded-t-lg"
                    style={{ background: cueStripe(card.role) }}
                  />
                  {/* Discreet dot in top-right for secondary confirmation. */}
                  <span
                    aria-hidden
                    className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
                    style={{ background: cueStripe(card.role), opacity: 0.7 }}
                  />
                </>
              )}

              <span className="flex flex-col items-center gap-0.5 w-full">
                {isAssassinRevealed && (
                  <span
                    aria-hidden
                    className="text-[9px] md:text-[10px] uppercase tracking-[0.22em] font-bold leading-none"
                    style={{
                      color: "color-mix(in oklch, var(--color-error) 60%, white 40%)",
                    }}
                  >
                    ☠ Assassin
                  </span>
                )}
                <span
                  className={[
                    "block leading-tight break-words whitespace-normal hyphens-auto w-full",
                    wordSizeClass(card.word),
                    card.revealed && !isAssassinRevealed ? "line-through opacity-80" : "",
                    isAssassinRevealed ? "font-bold" : "",
                  ].join(" ")}
                >
                  {card.word}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {!isOver && (
        <div className="w-full max-w-xl surface-ivory px-5 py-4 flex flex-col gap-3">
          {isCluing && isMyTurn && amSpymaster && (
            <>
              <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
                Give a one-word clue
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1 rounded-lg"
                  placeholder="clue word"
                  value={clueWord}
                  onChange={(e) => setClueWord(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void submitClue();
                  }}
                  maxLength={40}
                />
                <input
                  type="number"
                  className="input input-bordered w-20 text-center tabular-nums rounded-lg"
                  min={0}
                  max={9}
                  value={clueCount}
                  onChange={(e) =>
                    setClueCount(parseInt(e.target.value, 10) || 0)
                  }
                />
                <button
                  type="button"
                  className="btn btn-primary rounded-full px-5 font-semibold"
                  onClick={submitClue}
                >
                  Give
                </button>
              </div>
            </>
          )}
          {isCluing && !(isMyTurn && amSpymaster) && (
            <div className="text-sm text-base-content/65 text-center">
              Waiting on the{" "}
              <span
                className={
                  view.turn === "red"
                    ? "text-error font-semibold"
                    : "text-info font-semibold"
                }
              >
                {view.turn}
              </span>{" "}
              spymaster's clue…
            </div>
          )}
          {isGuessing && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
                  Clue
                </div>
                <div className="text-2xl font-display tracking-tight mt-0.5">
                  {view.clue?.word}
                  <span className="ml-2 text-base-content/50 tabular-nums">
                    {view.clue?.count}
                  </span>
                </div>
                <div className="text-xs text-base-content/55 mt-1">
                  {view.guessesLeft} guess
                  {view.guessesLeft === 1 ? "" : "es"} remaining
                </div>
              </div>
              {isMyTurn && !amSpymaster && (
                <button
                  type="button"
                  className="text-xs uppercase tracking-[0.2em] text-base-content/55 hover:text-base-content transition-colors"
                  onClick={endGuessing}
                >
                  End guessing →
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScoreDot({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      <span className="text-base-content/60">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function TurnIndicator({ view }: { view: CodenamesView }) {
  if (view.phase === "gameOver") return null;
  const team = view.turn;
  const color = team === "red" ? "var(--color-error)" : "var(--color-info)";
  const contentColor =
    team === "red" ? "var(--color-error-content)" : "var(--color-info-content)";
  return (
    <div
      className="px-5 py-2 rounded-full font-semibold text-sm tracking-wide flex items-center gap-2.5"
      style={{
        background: color,
        color: contentColor,
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -1px 0 oklch(0% 0 0 / 0.15)",
      }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {team === "red" ? "Red" : "Blue"} team{" "}
      <span className="opacity-70">·</span>{" "}
      <span className="uppercase tracking-[0.16em] text-xs">
        {view.phase === "cluing" ? "clue" : "guess"}
      </span>
    </div>
  );
}

function CodenamesLobbyPanel({
  config,
  onChange,
  players,
  isHost,
}: LobbyPanelProps<CodenamesConfig>) {
  const teams = config.teams ?? {};
  const spymasters = config.spymasters ?? {};

  const setTeam = (playerId: string, team: Team) => {
    onChange({ ...config, teams: { ...teams, [playerId]: team } });
  };
  const setSpymaster = (team: Team, playerId: string | undefined) => {
    onChange({
      ...config,
      spymasters: { ...spymasters, [team]: playerId },
    });
  };

  const red = players.filter((p) => teams[p.id] === "red");
  const blue = players.filter((p) => teams[p.id] === "blue");
  const unassigned = players.filter(
    (p) => teams[p.id] !== "red" && teams[p.id] !== "blue",
  );

  const isMissingSpymaster = (team: Team) => {
    const id = spymasters[team];
    if (!id) return true;
    return !(team === "red" ? red : blue).some((p) => p.id === id);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-base-content/65">
        {isHost
          ? "Pick teams and assign a spymaster for each side."
          : "The host is assigning teams."}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TeamColumn
          label="Red team"
          dot="var(--color-error)"
          members={red}
          spymasterId={spymasters.red}
          onSetSpymaster={(id) => isHost && setSpymaster("red", id)}
          onMove={(p) => isHost && setTeam(p, "blue")}
          moveLabel="→ Blue"
          isHost={isHost}
          missingSpymaster={isMissingSpymaster("red")}
        />
        <TeamColumn
          label="Blue team"
          dot="var(--color-info)"
          members={blue}
          spymasterId={spymasters.blue}
          onSetSpymaster={(id) => isHost && setSpymaster("blue", id)}
          onMove={(p) => isHost && setTeam(p, "red")}
          moveLabel="Red ←"
          isHost={isHost}
          missingSpymaster={isMissingSpymaster("blue")}
        />
      </div>

      {unassigned.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 mb-2">
            Unassigned
          </div>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((p) => (
              <div
                key={p.id}
                className="inline-flex items-center gap-2 rounded-full border border-base-300 bg-base-100 pl-3 pr-1.5 py-1"
              >
                <span className="font-semibold text-sm">{p.name}</span>
                {isHost && (
                  <>
                    <button
                      type="button"
                      onClick={() => setTeam(p.id, "red")}
                      className="text-xs px-2 py-0.5 rounded-full bg-error text-error-content font-semibold"
                    >
                      Red
                    </button>
                    <button
                      type="button"
                      onClick={() => setTeam(p.id, "blue")}
                      className="text-xs px-2 py-0.5 rounded-full bg-info text-info-content font-semibold"
                    >
                      Blue
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TeamColumn({
  label,
  dot,
  members,
  spymasterId,
  onSetSpymaster,
  onMove,
  moveLabel,
  isHost,
  missingSpymaster,
}: {
  label: string;
  dot: string;
  members: { id: string; name: string }[];
  spymasterId: string | undefined;
  onSetSpymaster: (id: string) => void;
  onMove: (playerId: string) => void;
  moveLabel: string;
  isHost: boolean;
  missingSpymaster: boolean;
}) {
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 rounded-full"
          aria-hidden
          style={{ background: dot }}
        />
        <h3 className="font-display text-lg tracking-tight">{label}</h3>
        <span className="text-xs text-base-content/50 ml-auto tabular-nums">
          {members.length} player{members.length === 1 ? "" : "s"}
        </span>
      </div>
      {missingSpymaster && (
        <div className="text-xs text-warning-content/80">
          ◆ No spymaster picked — one will be auto-assigned on start.
        </div>
      )}
      <ul className="flex flex-col gap-1">
        {members.length === 0 && (
          <li className="text-sm text-base-content/45 italic">empty</li>
        )}
        {members.map((p) => {
          const isSpy = p.id === spymasterId;
          return (
            <li
              key={p.id}
              className="flex items-center justify-between gap-2 py-1"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">{p.name}</span>
                {isSpy && (
                  <span className="text-[10px] uppercase tracking-[0.18em] text-primary font-semibold">
                    spymaster
                  </span>
                )}
              </div>
              {isHost && (
                <div className="flex gap-1">
                  {!isSpy && (
                    <button
                      type="button"
                      onClick={() => onSetSpymaster(p.id)}
                      className="text-xs px-2 py-0.5 rounded-full bg-base-200 hover:bg-base-300 transition-colors"
                      title="Make spymaster"
                    >
                      ★
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onMove(p.id)}
                    className="text-xs px-2 py-0.5 rounded-full bg-base-200 hover:bg-base-300 transition-colors"
                  >
                    {moveLabel}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CodenamesSummary({ view }: SummaryProps<CodenamesView>) {
  if (view.phase !== "gameOver" || !view.winner) return null;
  const reasonLabel =
    view.winReason === "assassin"
      ? "— the other team picked the assassin."
      : view.winReason === "lastCard"
        ? "— all agents found."
        : "";
  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center">
      <div
        className="text-[10px] uppercase tracking-[0.3em] font-semibold mb-1"
        style={{
          color:
            view.winner === "red" ? "var(--color-error)" : "var(--color-info)",
        }}
      >
        ◆ Victory ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        <span
          style={{
            color:
              view.winner === "red"
                ? "var(--color-error)"
                : "var(--color-info)",
          }}
        >
          {view.winner === "red" ? "Red" : "Blue"}
        </span>{" "}
        takes it.
      </div>
      {reasonLabel && (
        <div className="text-sm text-base-content/60 mt-1">{reasonLabel}</div>
      )}
    </div>
  );
}

export const codenamesClientModule: ClientGameModule<
  CodenamesView,
  CodenamesMove,
  CodenamesConfig
> = {
  type: CODENAMES_TYPE,
  Board: CodenamesBoard,
  LobbyPanel: CodenamesLobbyPanel,
  Summary: CodenamesSummary,
};
