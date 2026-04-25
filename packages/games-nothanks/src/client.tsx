import { useMemo } from "react";
import {
  Card as CardShell,
  PlayerUILayout,
  type BoardProps,
  type CardSize,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  NOTHANKS_TYPE,
  scoreCards,
  type NoThanksConfig,
  type NoThanksMove,
  type NoThanksView,
} from "./shared";

// ------------------------- Card visual -------------------------

function tintForValue(v: number): { from: string; to: string; ink: string } {
  // Map 3..35 onto a hue progression (cool -> warm) so consecutive cards look
  // related and high cards visibly louder.
  const t = (v - 3) / (35 - 3);
  // Hue from 220 (cool blue) to 25 (warm orange) — wraps through purple/red.
  const hue = 220 - t * 195;
  return {
    from: `oklch(78% 0.13 ${hue})`,
    to: `oklch(54% 0.15 ${hue})`,
    ink: `oklch(20% 0.05 ${hue})`,
  };
}

/** SVG face for the No Thanks deck — hue-mapped tint with corner indices and a big central numeral. */
function NoThanksFace({ value }: { value: number }) {
  const tint = tintForValue(value);
  const id = `nt-grad-${value}`;
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="none"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={tint.from} />
          <stop offset="100%" stopColor={tint.to} />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="140" fill={`url(#${id})`} />
      {/* Inner frame for card-game feel */}
      <rect
        x="6"
        y="6"
        width="88"
        height="128"
        rx="5"
        fill="none"
        stroke={tint.ink}
        strokeOpacity="0.18"
        strokeWidth="1"
      />
      {/* Decorative pip rings between corners and centerpiece */}
      <circle cx="50" cy="34" r="3.4" fill={tint.ink} fillOpacity="0.18" />
      <circle cx="50" cy="106" r="3.4" fill={tint.ink} fillOpacity="0.18" />
      {/* Corner indices */}
      <text
        x="11"
        y="22"
        fill={tint.ink}
        fontFamily="var(--font-display, serif)"
        fontWeight="800"
        fontSize="14"
      >
        {value}
      </text>
      <text
        x="89"
        y="118"
        fill={tint.ink}
        fontFamily="var(--font-display, serif)"
        fontWeight="800"
        fontSize="14"
        textAnchor="end"
        transform="rotate(180 89 118)"
      >
        {value}
      </text>
      {/* Central numeral */}
      <text
        x="50"
        y="84"
        fill={tint.ink}
        fontFamily="var(--font-display, serif)"
        fontWeight="900"
        fontSize="48"
        textAnchor="middle"
      >
        {value}
      </text>
    </svg>
  );
}

function Chip({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--color-warning) 80%, white) 0%, color-mix(in oklch, var(--color-warning) 65%, black) 100%)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.35), inset 0 -1px 2px oklch(0% 0 0 / 0.25)",
        flexShrink: 0,
      }}
    />
  );
}

// ------------------------- Run grouping -------------------------

function runs(cards: number[]): number[][] {
  if (cards.length === 0) return [];
  const sorted = [...cards].sort((a, b) => a - b);
  const out: number[][] = [];
  let curr: number[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const v = sorted[i]!;
    if (v === curr[curr.length - 1]! + 1) {
      curr.push(v);
    } else {
      out.push(curr);
      curr = [v];
    }
  }
  out.push(curr);
  return out;
}

// ------------------------- Board -------------------------

function NoThanksBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<NoThanksView, NoThanksMove>) {
  const playersById = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);
  const nameOf = (id: string) => playersById[id]?.name ?? id;

  const isOver = view.phase === "gameOver";
  const myChips = view.seats[me]?.chips ?? 0;
  const canPass = isMyTurn && !isOver && myChips > 0 && view.currentCard !== null;
  const canTake = isMyTurn && !isOver && view.currentCard !== null;

  const offerCard = view.currentCard;
  const offerChips = view.chipsOnCard;

  const projectedScoreIfTaken = useMemo(() => {
    if (!offerCard) return null;
    const cards = [...(view.seats[me]?.cards ?? []), offerCard];
    return scoreCards(cards, myChips + offerChips);
  }, [offerCard, offerChips, view.seats, me, myChips]);

  const projectedScoreIfPassed = useMemo(() => {
    return scoreCards(view.seats[me]?.cards ?? [], Math.max(0, myChips - 1));
  }, [view.seats, me, myChips]);

  const myTableau = (
    <Tableau id={me} view={view} playersById={playersById} isMe />
  );

  const opponentTableaus = view.players
    .filter((id) => id !== me)
    .map((id) => (
      <Tableau key={id} id={id} view={view} playersById={playersById} isMe={false} />
    ));

  const offerStage = !isOver && offerCard !== null && (
    <div
      className="rounded-2xl px-6 py-5 flex items-center gap-6 flex-wrap justify-center"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 65%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -1px 0 oklch(0% 0 0 / 0.18)",
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <CardShell size="xl" ariaLabel={`card ${offerCard} on offer`}>
          <NoThanksFace value={offerCard} />
        </CardShell>
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55 mt-2">
          On offer
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 min-w-[88px]">
        <div className="flex items-center gap-1 flex-wrap justify-center max-w-[120px]">
          {offerChips === 0 ? (
            <span className="text-xs italic text-base-content/40">
              no chips yet
            </span>
          ) : (
            Array.from({ length: offerChips }).map((_, i) => (
              <Chip key={i} size={14} />
            ))
          )}
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          {offerChips} chip{offerChips === 1 ? "" : "s"} on top
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 min-w-[88px]">
        <div
          className="rounded-lg px-3 py-1.5 text-sm font-semibold"
          style={{
            background:
              "color-mix(in oklch, var(--color-base-100) 80%, transparent)",
          }}
        >
          {view.deckCount}
        </div>
        <span className="text-[10px] uppercase tracking-[0.22em] text-base-content/55">
          cards left
        </span>
      </div>
    </div>
  );

  const actionRow = !isOver && isMyTurn && offerCard !== null && (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <button
        type="button"
        onClick={() => sendMove({ kind: "pass" })}
        disabled={!canPass}
        className="btn btn-ghost rounded-full px-5 font-semibold"
        title={
          canPass
            ? `Pass — pay 1 chip, score becomes ${projectedScoreIfPassed}`
            : "No chips left — you must take"
        }
      >
        No thanks (pay 1 chip)
      </button>
      <button
        type="button"
        onClick={() => sendMove({ kind: "take" })}
        disabled={!canTake}
        className="btn btn-primary rounded-full px-5 font-semibold"
        title={
          projectedScoreIfTaken !== null
            ? `Take — score becomes ${projectedScoreIfTaken}`
            : "Take the card and pile of chips"
        }
      >
        Take card + {offerChips} chip{offerChips === 1 ? "" : "s"}
      </button>
    </div>
  );

  const idleHint = !isOver && !isMyTurn && (
    <div className="text-xs text-base-content/55 italic text-center">
      Waiting on {nameOf(view.current)}…
    </div>
  );

  return (
    <PlayerUILayout
      topStrip={
        <div className="flex flex-col items-center gap-3">
          <Scoreboard view={view} playersById={playersById} me={me} />
          <StatusBanner
            view={view}
            isMyTurn={isMyTurn}
            currentName={nameOf(view.current)}
          />
        </div>
      }
      main={
        <div className="flex flex-col items-center gap-4 w-full">
          {offerStage}
          {actionRow}
          {idleHint}
          {opponentTableaus.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
              {opponentTableaus}
            </div>
          )}
        </div>
      }
      bottomStrip={
        <div className="flex flex-col gap-3 w-full">
          {myTableau}
          {isOver && view.finalScores && (
            <GameOverPanel view={view} playersById={playersById} me={me} />
          )}
        </div>
      }
      containerMaxWidth={1200}
    />
  );
}

// ------------------------- Subcomponents -------------------------

function Scoreboard({
  view,
  playersById,
  me,
}: {
  view: NoThanksView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
      {view.players.map((id) => {
        const p = playersById[id] ?? { id, name: id };
        const seat = view.seats[id];
        const chips = seat?.chips ?? 0;
        const cards = seat?.cards ?? [];
        const provisional = scoreCards(cards, chips);
        const active =
          view.current === id && view.phase === "play";
        const isMe = id === me;
        return (
          <div
            key={id}
            className={[
              "rounded-xl px-3 py-2 flex flex-col items-center gap-1 min-w-[110px] border transition-colors",
              active
                ? "border-primary/55 bg-primary/10"
                : "border-base-300/80 bg-base-100",
            ].join(" ")}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={[
                  "text-xs font-semibold truncate max-w-[110px]",
                  active ? "text-primary" : "",
                ].join(" ")}
              >
                {p.name}
              </span>
              {isMe && (
                <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/50">
                  you
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] tabular text-base-content/65">
              <span className="flex items-center gap-1">
                <Chip size={10} />
                {chips}
              </span>
              <span>·</span>
              <span>{cards.length} cards</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-base-content/50">
              score {provisional}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusBanner({
  view,
  isMyTurn,
  currentName,
}: {
  view: NoThanksView;
  isMyTurn: boolean;
  currentName: string;
}) {
  if (view.phase === "gameOver") {
    return (
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        Game over
      </div>
    );
  }
  return (
    <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
      {isMyTurn ? (
        <span className="text-primary font-bold">Your call — take or pass</span>
      ) : (
        <>
          Waiting on{" "}
          <span className="text-base-content font-bold">{currentName}</span>
        </>
      )}
    </div>
  );
}

function Tableau({
  id,
  view,
  playersById,
  isMe,
}: {
  id: string;
  view: NoThanksView;
  playersById: Record<string, { id: string; name: string }>;
  isMe: boolean;
}) {
  const p = playersById[id] ?? { id, name: id };
  const seat = view.seats[id];
  const cards = seat?.cards ?? [];
  const chips = seat?.chips ?? 0;
  const grouped = useMemo(() => runs(cards), [cards]);
  const active = view.current === id && view.phase === "play";

  return (
    <div
      className={[
        "rounded-xl p-3 border flex flex-col gap-2 transition-colors",
        active
          ? "border-primary/55 bg-primary/10"
          : "border-base-300/70 bg-base-100",
      ].join(" ")}
    >
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={[
            "text-sm font-semibold truncate max-w-[160px]",
            active ? "text-primary" : "",
          ].join(" ")}
        >
          {p.name}
        </span>
        {isMe && (
          <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/50">
            you
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-base-content/60 tabular">
          <Chip size={11} /> {chips}
        </span>
      </div>
      {grouped.length === 0 ? (
        <div className="text-xs italic text-base-content/40 py-3 text-center">
          no cards yet
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {grouped.map((run, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg"
              style={{
                background:
                  "color-mix(in oklch, var(--color-base-300) 35%, transparent)",
              }}
            >
              <div className="flex">
                {run.map((v, j) => (
                  <div
                    key={v}
                    style={{
                      marginLeft: j === 0 ? 0 : -22,
                      zIndex: j,
                    }}
                  >
                    <CardShell size={"xs" as CardSize} ariaLabel={`card ${v}`}>
                      <NoThanksFace value={v} />
                    </CardShell>
                  </div>
                ))}
              </div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-base-content/50">
                counts {run[0]}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GameOverPanel({
  view,
  playersById,
  me,
}: {
  view: NoThanksView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  const ranked = [...view.players].sort(
    (a, b) =>
      (view.finalScores![a] ?? 0) - (view.finalScores![b] ?? 0),
  );
  const winners = view.winners ?? [];
  const winnerNames = winners
    .map((id) => playersById[id]?.name ?? id)
    .join(" & ");
  return (
    <div
      className="max-w-3xl w-full rounded-2xl p-5 flex flex-col gap-3 parlor-fade"
      style={{
        background:
          "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)",
      }}
    >
      <div>
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
          ◆ Final scores ◆
        </div>
        <div
          className="font-display tracking-tight"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          {winners.includes(me)
            ? `You took it — ${winnerNames} wins`
            : `${winnerNames} wins`}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {ranked.map((id, i) => {
          const seat = view.seats[id];
          const chips = seat?.chips ?? 0;
          const cards = seat?.cards ?? [];
          const score = view.finalScores![id] ?? 0;
          const isWinner = winners.includes(id);
          return (
            <div
              key={id}
              className={[
                "flex items-center gap-3 rounded-lg px-3 py-2",
                isWinner ? "bg-success/15" : "bg-base-100/60",
              ].join(" ")}
            >
              <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55 w-6">
                #{i + 1}
              </span>
              <span className="font-semibold flex-1 truncate">
                {playersById[id]?.name ?? id}
              </span>
              <span className="text-xs text-base-content/65 tabular">
                {cards.length} cards · {chips} chips
              </span>
              <span
                className={[
                  "tabular font-display",
                  isWinner ? "text-success" : "",
                ].join(" ")}
                style={{ fontSize: "var(--text-display-sm)" }}
              >
                {score}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const noThanksClientModule: ClientGameModule<
  NoThanksView,
  NoThanksMove,
  NoThanksConfig
> = {
  type: NOTHANKS_TYPE,
  Board: NoThanksBoard,
};
