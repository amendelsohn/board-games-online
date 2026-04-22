import { useMemo, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  DIE_FACES,
  LIARS_DICE_TYPE,
  type Face,
  type LiarsDiceConfig,
  type LiarsDiceMove,
  type LiarsDiceReveal,
  type LiarsDiceView,
} from "./shared";

// ------------------------- Die pip layout -------------------------

const PIP_LAYOUT: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [
    [0.25, 0.25],
    [0.75, 0.75],
  ],
  3: [
    [0.25, 0.25],
    [0.5, 0.5],
    [0.75, 0.75],
  ],
  4: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  5: [
    [0.25, 0.25],
    [0.75, 0.25],
    [0.5, 0.5],
    [0.25, 0.75],
    [0.75, 0.75],
  ],
  6: [
    [0.25, 0.2],
    [0.75, 0.2],
    [0.25, 0.5],
    [0.75, 0.5],
    [0.25, 0.8],
    [0.75, 0.8],
  ],
};

function Die({
  value,
  size = 40,
  tone = "ivory",
  highlight = false,
}: {
  value: number;
  size?: number;
  tone?: "ivory" | "primary";
  highlight?: boolean;
}) {
  const pips = PIP_LAYOUT[value] ?? [];
  const body =
    tone === "primary"
      ? "var(--color-primary)"
      : "var(--color-base-100)";
  const pipFill =
    tone === "primary"
      ? "var(--color-primary-content)"
      : "var(--color-base-content)";
  const ring = highlight
    ? "0 0 0 2px var(--color-success), 0 8px 18px color-mix(in oklch, var(--color-success) 30%, transparent)"
    : "inset 0 1px 0 oklch(100% 0 0 / 0.25), inset 0 -1px 0 oklch(0% 0 0 / 0.18), 0 2px 4px oklch(0% 0 0 / 0.15)";
  return (
    <div
      className="rounded-lg relative shrink-0"
      style={{
        width: size,
        height: size,
        background: body,
        boxShadow: ring,
        transition: "box-shadow 200ms ease",
      }}
      aria-label={`die ${value}`}
    >
      <svg
        viewBox="0 0 1 1"
        className="absolute inset-0 w-full h-full"
      >
        {pips.map(([x, y], i) => (
          <circle
            key={i}
            cx={x}
            cy={y}
            r={0.085}
            fill={pipFill}
          />
        ))}
      </svg>
    </div>
  );
}

// ------------------------- Board -------------------------

function LiarsDiceBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<LiarsDiceView, LiarsDiceMove>) {
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const isOver = view.phase === "gameOver";
  const inBidding = view.phase === "bidding";
  const inReveal = view.phase === "reveal";
  const iAmOut = (view.diceCount[me] ?? 0) === 0;
  const iAmStarter = view.current === me;

  const totalDice = useMemo(
    () => Object.values(view.diceCount).reduce((a, b) => a + b, 0),
    [view.diceCount],
  );

  const myDice = view.myDice ?? [];
  const currentBid = view.currentBid;

  // Bid form state — stepper value kept raw; we clamp at display/submit time
  // so React doesn't have to re-render from a setter during render.
  const minCount = currentBid ? currentBid.count : 1;
  const [rawCount, setRawCount] = useState<number>(minCount);
  const [face, setFace] = useState<Face>(
    (currentBid?.face ?? 2) as Face,
  );
  const count = Math.max(minCount, rawCount);
  const setCount = (n: number) => setRawCount(n);

  const nameOf = (id: string) => playersById[id]?.name ?? id;

  const submitBid = async () => {
    if (!inBidding || !isMyTurn || isOver) return;
    await sendMove({ kind: "bid", count, face });
  };
  const submitChallenge = async () => {
    if (!inBidding || !isMyTurn || isOver || !currentBid) return;
    await sendMove({ kind: "challenge" });
  };
  const submitSpotOn = async () => {
    if (!inBidding || !isMyTurn || isOver || !currentBid) return;
    await sendMove({ kind: "spotOn" });
  };
  const submitNextRound = async () => {
    if (!inReveal || !iAmStarter) return;
    await sendMove({ kind: "startNextRound" });
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <Scoreboard
        view={view}
        playersById={playersById}
        me={me}
      />

      <div
        className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold"
      >
        Dice still in play:{" "}
        <span className="text-base-content font-bold tabular">{totalDice}</span>
      </div>

      {currentBid && !inReveal && (
        <CurrentBidCard
          bid={currentBid}
          name={nameOf(currentBid.by)}
        />
      )}

      {!currentBid && inBidding && (
        <div className="text-sm text-base-content/65 italic">
          Opening round — {nameOf(view.current)} makes the first bid.
        </div>
      )}

      {!iAmOut && !isOver && (
        <MyCup dice={myDice} />
      )}
      {iAmOut && !isOver && (
        <div className="text-sm text-base-content/55 italic">
          You're out. Spectate to the finish.
        </div>
      )}

      {inBidding && isMyTurn && !iAmOut && (
        <BidForm
          currentBid={currentBid}
          count={count}
          face={face}
          setCount={setCount}
          setFace={setFace}
          onBid={submitBid}
          onChallenge={submitChallenge}
          onSpotOn={submitSpotOn}
          totalDice={totalDice}
        />
      )}

      {inBidding && !isMyTurn && !isOver && (
        <div className="text-sm text-base-content/65">
          Waiting on{" "}
          <span className="font-semibold text-base-content">
            {nameOf(view.current)}
          </span>
          …
        </div>
      )}

      {(inReveal || isOver) && view.lastReveal && (
        <RevealPanel
          reveal={view.lastReveal}
          playersById={playersById}
          iAmStarter={iAmStarter}
          showAdvance={inReveal}
          onNextRound={submitNextRound}
        />
      )}

      {isOver && view.winner && (
        <div className="text-sm text-base-content/80">
          <span className="font-semibold">{nameOf(view.winner)}</span> is the
          last with dice.
        </div>
      )}
    </div>
  );
}

// ------------------------- Scoreboard -------------------------

function Scoreboard({
  view,
  playersById,
  me,
}: {
  view: LiarsDiceView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
      {view.players.map((id) => {
        const p = playersById[id] ?? { id, name: id };
        const count = view.diceCount[id] ?? 0;
        const out = count === 0;
        const active = view.current === id && view.phase !== "gameOver";
        const isMe = id === me;
        return (
          <div
            key={id}
            className={[
              "rounded-xl px-3 py-2 flex flex-col items-center gap-1 min-w-[92px]",
              "border transition-colors",
              out
                ? "border-base-300/50 bg-base-200/40 text-base-content/40"
                : active
                  ? "border-primary/50 bg-primary/10"
                  : "border-base-300/80 bg-base-100",
            ].join(" ")}
          >
            <div className="flex items-center gap-1">
              <span
                className={[
                  "text-xs font-semibold truncate max-w-[110px]",
                  active ? "text-primary" : "",
                ].join(" ")}
              >
                {p.name}
              </span>
              {isMe && (
                <span className="text-[9px] uppercase tracking-[0.2em] text-base-content/50">
                  you
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => {
                const filled = i < count;
                return (
                  <span
                    key={i}
                    className="rounded-sm"
                    style={{
                      width: 7,
                      height: 7,
                      background: filled
                        ? "var(--color-primary)"
                        : "color-mix(in oklch, var(--color-base-300) 90%, transparent)",
                      boxShadow: filled
                        ? "inset 0 -1px 0 oklch(0% 0 0 / 0.2)"
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/50 tabular">
              {out ? "out" : `${count} dice`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------- Current bid -------------------------

function CurrentBidCard({ bid, name }: { bid: { count: number; face: Face }; name: string }) {
  return (
    <div
      className="rounded-2xl px-5 py-3 flex items-center gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-primary) 14%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        On the table
      </div>
      <div className="flex items-center gap-2">
        <span
          className="font-display tracking-tight tabular"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          {bid.count}
        </span>
        <span className="text-sm text-base-content/65">×</span>
        <Die value={bid.face} size={32} tone="primary" />
      </div>
      <div className="text-xs text-base-content/65">
        by <span className="font-semibold">{name}</span>
      </div>
    </div>
  );
}

// ------------------------- My cup -------------------------

function MyCup({ dice }: { dice: number[] }) {
  if (dice.length === 0) return null;
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center gap-2"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 75%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.15), inset 0 -1px 0 oklch(0% 0 0 / 0.15)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Your cup — only you can see
      </div>
      <div className="flex items-center gap-2">
        {dice.map((d, i) => (
          <Die key={i} value={d} size={52} />
        ))}
      </div>
    </div>
  );
}

// ------------------------- Bid form -------------------------

function BidForm({
  currentBid,
  count,
  face,
  setCount,
  setFace,
  onBid,
  onChallenge,
  onSpotOn,
  totalDice,
}: {
  currentBid: { count: number; face: Face } | null;
  count: number;
  face: Face;
  setCount: (n: number) => void;
  setFace: (f: Face) => void;
  onBid: () => void;
  onChallenge: () => void;
  onSpotOn: () => void;
  totalDice: number;
}) {
  const canChallenge = currentBid !== null;
  const minCount = currentBid ? currentBid.count : 1;
  const maxCount = Math.max(totalDice, minCount + 10);

  const inc = () => setCount(Math.min(maxCount, count + 1));
  const dec = () => setCount(Math.max(minCount, count - 1));

  return (
    <div className="surface-ivory max-w-xl w-full p-5 flex flex-col gap-4">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Your turn
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-circle btn-sm btn-ghost"
            onClick={dec}
            aria-label="decrement"
            disabled={count <= minCount}
          >
            −
          </button>
          <div
            className="font-display tracking-tight tabular text-center"
            style={{ fontSize: "var(--text-display-sm)", minWidth: "2.5ch" }}
          >
            {count}
          </div>
          <button
            type="button"
            className="btn btn-circle btn-sm btn-ghost"
            onClick={inc}
            aria-label="increment"
          >
            +
          </button>
        </div>
        <span className="text-sm text-base-content/65">×</span>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(Array.from({ length: DIE_FACES }, (_, i) => (i + 1)) as Face[]).map(
            (f) => {
              const selected = f === face;
              return (
                <button
                  key={f}
                  type="button"
                  className={[
                    "rounded-lg p-1 transition-transform",
                    selected
                      ? "ring-2 ring-primary scale-[1.06]"
                      : "opacity-70 hover:opacity-100",
                  ].join(" ")}
                  onClick={() => setFace(f)}
                >
                  <Die value={f} size={34} tone={selected ? "primary" : "ivory"} />
                </button>
              );
            },
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <button
          type="button"
          className="btn btn-primary rounded-full px-5 font-semibold"
          onClick={onBid}
        >
          Bid {count} × {face}
        </button>
        <button
          type="button"
          className="btn btn-error rounded-full px-5 font-semibold"
          onClick={onChallenge}
          disabled={!canChallenge}
        >
          Liar!
        </button>
        <button
          type="button"
          className="btn btn-warning rounded-full px-5 font-semibold"
          onClick={onSpotOn}
          disabled={!canChallenge}
        >
          Spot on
        </button>
      </div>

      {!canChallenge && (
        <div className="text-xs text-base-content/55 text-center italic">
          Opening bid — any count of any face. Challenge and Spot-on unlock
          once someone has bid.
        </div>
      )}
      {canChallenge && (
        <div className="text-xs text-base-content/55 text-center">
          Raise the count, raise the face, or call the bluff. Ones are wild
          except when the bid is on ones.
        </div>
      )}
    </div>
  );
}

// ------------------------- Reveal -------------------------

function RevealPanel({
  reveal,
  playersById,
  iAmStarter,
  showAdvance,
  onNextRound,
}: {
  reveal: LiarsDiceReveal;
  playersById: Record<string, { id: string; name: string }>;
  iAmStarter: boolean;
  showAdvance: boolean;
  onNextRound: () => void;
}) {
  const bidderName = playersById[reveal.bid.by]?.name ?? reveal.bid.by;
  const headline: Record<LiarsDiceReveal["resolution"], string> = {
    bidderLost: `Bluff called — ${bidderName} loses a die.`,
    challengerLost: `Bid holds — the challenger loses a die.`,
    spotOnWin: `Spot on — the caller gains a die.`,
    spotOnLost: `Missed — the caller loses a die.`,
  };

  return (
    <div
      className="max-w-3xl w-full rounded-2xl p-5 flex flex-col gap-4 parlor-fade"
      style={{
        background:
          "color-mix(in oklch, var(--color-warning) 16%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-warning) 45%, transparent)",
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-warning-content">
            ◆ Reveal ◆
          </div>
          <div
            className="font-display tracking-tight"
            style={{ fontSize: "var(--text-display-sm)" }}
          >
            {headline[reveal.resolution]}
          </div>
          <div className="text-sm text-base-content/70">
            Bid was{" "}
            <span className="font-semibold tabular">{reveal.bid.count}</span>{" "}
            ×{" "}
            <span className="font-semibold tabular">{reveal.bid.face}</span>.
            Actual total:{" "}
            <span className="font-semibold tabular">{reveal.actual}</span>
            {reveal.bid.face !== 1 && " (ones wild)"}.
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {Object.entries(reveal.dice).map(([id, dice]) => {
          const name = playersById[id]?.name ?? id;
          return (
            <div
              key={id}
              className="flex items-center gap-3 flex-wrap rounded-lg bg-base-100/60 px-3 py-2"
            >
              <div className="min-w-[110px] text-sm font-semibold truncate">
                {name}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {dice.length === 0 && (
                  <span className="text-xs italic text-base-content/50">
                    (no dice)
                  </span>
                )}
                {dice.map((d, i) => {
                  const matches =
                    d === reveal.bid.face ||
                    (reveal.bid.face !== 1 && d === 1);
                  return (
                    <Die
                      key={i}
                      value={d}
                      size={34}
                      highlight={matches}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showAdvance && iAmStarter && (
        <div className="flex justify-end">
          <button
            type="button"
            className="btn btn-primary rounded-full px-5 font-semibold"
            onClick={onNextRound}
          >
            Next round
          </button>
        </div>
      )}
      {showAdvance && !iAmStarter && (
        <div className="text-xs text-base-content/55 italic">
          Waiting for{" "}
          {playersById[reveal.nextStarter]?.name ?? reveal.nextStarter} to
          start the next round…
        </div>
      )}
    </div>
  );
}

export const liarsDiceClientModule: ClientGameModule<
  LiarsDiceView,
  LiarsDiceMove,
  LiarsDiceConfig
> = {
  type: LIARS_DICE_TYPE,
  Board: LiarsDiceBoard,
};
