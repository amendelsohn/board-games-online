import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  DIE_FACES,
  LIARS_DICE_TYPE,
  type Face,
  type LiarsDiceBidOnTable,
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
  dim = false,
  style,
  className,
}: {
  value: number;
  size?: number;
  tone?: "ivory" | "primary";
  highlight?: boolean;
  dim?: boolean;
  style?: React.CSSProperties;
  className?: string;
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
      className={["rounded-lg relative shrink-0", className ?? ""].join(" ")}
      style={{
        width: size,
        height: size,
        background: body,
        boxShadow: ring,
        opacity: dim ? 0.45 : 1,
        transition: "box-shadow 200ms ease, opacity 200ms ease",
        ...style,
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

  // Bid form state.
  const minCount = currentBid ? currentBid.count : 1;
  const [rawCount, setRawCount] = useState<number>(minCount);
  const [face, setFace] = useState<Face>(
    (currentBid?.face ?? 2) as Face,
  );
  const count = Math.max(minCount, rawCount);
  const setCount = (n: number) => setRawCount(n);

  const nameOf = (id: string) => playersById[id]?.name ?? id;

  // Die-loss / die-gain flash. Track previous diceCount and fire a 900ms
  // tint on the scoreboard card of any player whose count changed.
  const prevDiceCount = useRef<Record<string, number>>(view.diceCount);
  const [flashByPlayer, setFlashByPlayer] = useState<
    Record<string, "loss" | "gain">
  >({});
  useEffect(() => {
    const prev = prevDiceCount.current;
    const newFlashes: Record<string, "loss" | "gain"> = {};
    for (const id of Object.keys(view.diceCount)) {
      const before = prev[id];
      const now = view.diceCount[id] ?? 0;
      if (before !== undefined && before !== now) {
        newFlashes[id] = now > before ? "gain" : "loss";
      }
    }
    prevDiceCount.current = view.diceCount;
    if (Object.keys(newFlashes).length === 0) return;
    setFlashByPlayer(newFlashes);
    const t = setTimeout(() => setFlashByPlayer({}), 900);
    return () => clearTimeout(t);
  }, [view.diceCount]);

  // Round-start tumble: when myDice values change (new values post-reveal),
  // bump a nonce that re-triggers the per-die keyframes animation.
  const prevMyDiceRef = useRef<string>(myDice.join(","));
  const [tumbleNonce, setTumbleNonce] = useState(0);
  useEffect(() => {
    const sig = myDice.join(",");
    if (sig !== prevMyDiceRef.current && myDice.length > 0) {
      prevMyDiceRef.current = sig;
      setTumbleNonce((n) => n + 1);
    } else {
      prevMyDiceRef.current = sig;
    }
  }, [myDice]);

  // Next-to-act player: skips players with 0 dice.
  const nextToAct = useMemo(() => {
    if (!inBidding) return null;
    const players = view.players;
    const idx = players.indexOf(view.current);
    if (idx < 0) return null;
    for (let step = 1; step <= players.length; step++) {
      const candidate = players[(idx + step) % players.length]!;
      if ((view.diceCount[candidate] ?? 0) > 0) return candidate;
    }
    return null;
  }, [inBidding, view.players, view.current, view.diceCount]);

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

  const bidHistory = extractBidHistory(view);

  return (
    <div
      className="flex flex-col items-center gap-5 w-full"
      role="status"
      aria-live="polite"
    >
      <style>{`
        @keyframes liars-tumble {
          0%   { transform: rotate(0deg) scale(0.7); opacity: 0.2; }
          60%  { transform: rotate(540deg) scale(1.06); opacity: 1; }
          100% { transform: rotate(720deg) scale(1); opacity: 1; }
        }
        @keyframes liars-shake {
          0%   { transform: translateX(0); }
          15%  { transform: translateX(-3px); }
          30%  { transform: translateX(3px); }
          45%  { transform: translateX(-2px); }
          60%  { transform: translateX(2px); }
          75%  { transform: translateX(-1px); }
          100% { transform: translateX(0); }
        }
        @keyframes liars-pip-gain {
          0%   { transform: scale(0); opacity: 0; }
          60%  { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes liars-cta-pulse {
          0%, 100% { box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 40%, transparent), 0 0 16px color-mix(in oklch, var(--color-primary) 20%, transparent); }
          50%      { box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 60%, transparent), 0 0 28px color-mix(in oklch, var(--color-primary) 32%, transparent); }
        }
      `}</style>

      <Scoreboard
        view={view}
        playersById={playersById}
        me={me}
        nextToAct={nextToAct}
        flashByPlayer={flashByPlayer}
      />

      <div
        className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold font-mono tabular-nums"
      >
        Dice in play:{" "}
        <span className="text-base-content font-bold">{totalDice}</span>
      </div>

      {bidHistory.length > 0 && (
        <BidHistoryStrip
          history={bidHistory}
          playersById={playersById}
          currentBid={currentBid}
        />
      )}

      {currentBid && !inReveal && (
        <div className="flex flex-col items-center gap-2">
          <CurrentBidCard
            bid={currentBid}
            name={nameOf(currentBid.by)}
          />
          <OnesWildChip face={currentBid.face} />
        </div>
      )}

      {!currentBid && inBidding && !isMyTurn && (
        <div className="text-sm text-base-content/65 italic">
          Opening round — {nameOf(view.current)} makes the first bid.
        </div>
      )}

      {!currentBid && inBidding && isMyTurn && !iAmOut && (
        <div
          className="rounded-full px-4 py-1.5 font-display text-sm uppercase tracking-[0.22em] font-bold"
          style={{
            background: "color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100))",
            color: "var(--color-primary)",
            border: "1px solid color-mix(in oklch, var(--color-primary) 50%, transparent)",
            animation: "liars-cta-pulse 2.2s ease-in-out infinite",
          }}
        >
          Opening round — you bid first
        </div>
      )}

      {!iAmOut && !isOver && (
        <MyCup dice={myDice} tumbleNonce={tumbleNonce} />
      )}
      {iAmOut && !isOver && (
        <div
          className="rounded-2xl px-6 py-4 text-sm text-base-content/55 italic text-center"
          style={{
            border:
              "1px dashed color-mix(in oklch, var(--color-base-content) 28%, transparent)",
            minWidth: 220,
          }}
        >
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

// ------------------------- Bid history -------------------------

/**
 * The server view doesn't currently expose a bidHistory array. We fall back
 * to the currentBid only (and the lastReveal's bid when we're mid-reveal),
 * so the strip remains informative without server coordination. Flagged for
 * a follow-up — full history requires server-side persistence.
 */
function extractBidHistory(view: LiarsDiceView): LiarsDiceBidOnTable[] {
  const history: LiarsDiceBidOnTable[] = [];
  // Mid-reveal: the bid being resolved is the tail.
  if (view.phase === "reveal" && view.lastReveal) {
    history.push(view.lastReveal.bid);
  } else if (view.currentBid) {
    history.push(view.currentBid);
  }
  return history;
}

function BidHistoryStrip({
  history,
  playersById,
  currentBid,
}: {
  history: LiarsDiceBidOnTable[];
  playersById: Record<string, { id: string; name: string }>;
  currentBid: LiarsDiceBidOnTable | null;
}) {
  // Show last 5 desktop, last 3 mobile.
  const visible = history.slice(-5);
  return (
    <div className="w-full max-w-xl overflow-x-auto">
      <div className="flex items-center gap-2 px-3 justify-center flex-wrap">
        <span className="text-[9px] uppercase tracking-[0.22em] font-semibold text-base-content/45 shrink-0">
          History
        </span>
        {visible.map((b, i) => {
          const isCurrent = currentBid && b.by === currentBid.by && b.count === currentBid.count && b.face === currentBid.face;
          const name = playersById[b.by]?.name ?? b.by;
          const initial = name[0]?.toUpperCase() ?? "?";
          return (
            <div
              key={`${b.by}-${i}`}
              className={[
                "flex items-center gap-1.5 px-2 py-1 rounded-full shrink-0",
                isCurrent
                  ? "bg-primary/15 border border-primary/45"
                  : "bg-base-200/70 border border-base-300/50",
              ].join(" ")}
              style={{ opacity: isCurrent ? 1 : 0.62 }}
              title={`${name}: ${b.count} × ${b.face}`}
            >
              <span
                className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-bold font-mono tabular-nums"
                style={{
                  background: "color-mix(in oklch, var(--color-primary) 22%, var(--color-base-100))",
                  color: "var(--color-primary)",
                }}
              >
                {initial}
              </span>
              <span className="text-xs font-mono tabular-nums font-semibold">
                {b.count}
              </span>
              <span className="text-xs text-base-content/55">×</span>
              <Die value={b.face} size={isCurrent ? 18 : 16} tone={isCurrent ? "primary" : "ivory"} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------- Ones-wild chip -------------------------

function OnesWildChip({ face }: { face: Face | null }) {
  const onesBid = face === 1;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-semibold"
      style={
        onesBid
          ? {
              background: "color-mix(in oklch, var(--color-warning) 22%, var(--color-base-100))",
              color: "var(--color-warning)",
              border: "1px solid color-mix(in oklch, var(--color-warning) 45%, transparent)",
            }
          : {
              background: "color-mix(in oklch, var(--color-base-300) 80%, transparent)",
              color: "color-mix(in oklch, var(--color-base-content) 60%, transparent)",
            }
      }
    >
      {onesBid ? "Ones bid — not wild" : "Ones wild"}
    </span>
  );
}

// ------------------------- Scoreboard -------------------------

function Scoreboard({
  view,
  playersById,
  me,
  nextToAct,
  flashByPlayer,
}: {
  view: LiarsDiceView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  nextToAct: string | null;
  flashByPlayer: Record<string, "loss" | "gain">;
}) {
  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-3xl">
      {view.players.map((id) => {
        const p = playersById[id] ?? { id, name: id };
        const count = view.diceCount[id] ?? 0;
        const out = count === 0;
        const active = view.current === id && view.phase !== "gameOver";
        const isMe = id === me;
        const isNext = nextToAct === id;
        const flash = flashByPlayer[id];
        const pipTint = pipColorForCount(count);
        return (
          <div
            key={id}
            className={[
              "rounded-xl px-3 py-2 flex flex-col items-center gap-1 min-w-[92px]",
              "border transition-colors",
              out
                ? "border-base-300/50 bg-base-200/40 text-base-content/40"
                : active
                  ? "border-primary/55 bg-primary/10"
                  : isNext
                    ? "border-primary/25 bg-primary/5"
                    : "border-base-300/80 bg-base-100",
            ].join(" ")}
            style={{
              animation: flash
                ? "liars-shake 500ms ease-out"
                : undefined,
              backgroundColor: flash === "loss"
                ? "color-mix(in oklch, var(--color-error) 18%, var(--color-base-100))"
                : flash === "gain"
                  ? "color-mix(in oklch, var(--color-success) 18%, var(--color-base-100))"
                  : undefined,
              transition: "background-color 400ms ease",
            }}
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
                const isNewlyGained =
                  flash === "gain" && i === count - 1;
                return (
                  <span
                    key={i}
                    className="rounded-sm"
                    style={{
                      width: 7,
                      height: 7,
                      background: filled
                        ? pipTint
                        : "color-mix(in oklch, var(--color-base-300) 90%, transparent)",
                      boxShadow: filled
                        ? "inset 0 -1px 0 oklch(0% 0 0 / 0.2)"
                        : undefined,
                      animation: isNewlyGained
                        ? "liars-pip-gain 500ms ease-out"
                        : undefined,
                      transformOrigin: "center",
                    }}
                  />
                );
              })}
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/50 font-mono tabular-nums">
              {out ? "out" : `${count} dice`}
            </div>
            {isNext && !active && !out && (
              <div className="text-[8px] uppercase tracking-[0.24em] text-primary/75 font-bold">
                next
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function pipColorForCount(count: number): string {
  if (count >= 5) return "var(--color-primary)";
  if (count >= 3) return "color-mix(in oklch, var(--color-primary) 85%, transparent)";
  if (count === 2)
    return "color-mix(in oklch, var(--color-warning) 70%, var(--color-primary) 30%)";
  if (count === 1)
    return "color-mix(in oklch, var(--color-error) 60%, var(--color-warning) 40%)";
  return "var(--color-primary)";
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
          className="font-display tracking-tight tabular-nums"
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

function MyCup({ dice, tumbleNonce }: { dice: number[]; tumbleNonce: number }) {
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
          <Die
            // Keyed by (nonce, index) so a new round of dice re-mounts and
            // re-runs the tumble keyframes.
            key={`${tumbleNonce}-${i}`}
            value={d}
            size={52}
            style={{
              animation: `liars-tumble 400ms ease-out`,
              animationDelay: `${i * 80}ms`,
              animationFillMode: "both",
            }}
          />
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
  const incFive = () => setCount(Math.min(maxCount, count + 5));
  const decFive = () => setCount(Math.max(minCount, count - 5));

  return (
    <div className="surface-ivory max-w-xl w-full p-5 flex flex-col gap-4">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Your turn
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="btn btn-xs btn-ghost rounded-full px-2 font-bold"
            onClick={decFive}
            aria-label="decrement by five"
            disabled={count <= minCount}
          >
            −5
          </button>
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
            className="font-display tracking-tight tabular-nums text-center"
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
          <button
            type="button"
            className="btn btn-xs btn-ghost rounded-full px-2 font-bold"
            onClick={incFive}
            aria-label="increment by five"
          >
            +5
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

      {/* Action hierarchy: big Bid row; smaller challenge pair below. */}
      <div className="flex flex-col gap-2 items-center">
        <button
          type="button"
          className="btn btn-primary rounded-full px-6 font-semibold w-full sm:w-auto sm:min-w-[200px]"
          onClick={onBid}
        >
          Bid {count} × {face}
        </button>
        <div className="flex flex-row gap-2 justify-center flex-wrap">
          <button
            type="button"
            className="btn btn-sm btn-outline btn-error rounded-full px-4 font-semibold"
            onClick={onChallenge}
            disabled={!canChallenge}
          >
            Liar!
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline btn-warning rounded-full px-4 font-semibold"
            onClick={onSpotOn}
            disabled={!canChallenge}
          >
            Spot on
          </button>
        </div>
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

  const actualTintClass =
    reveal.resolution === "bidderLost" || reveal.resolution === "spotOnWin"
      ? "text-success"
      : reveal.resolution === "challengerLost" || reveal.resolution === "spotOnLost"
        ? "text-error"
        : "text-warning";

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
            <span className="font-semibold font-mono tabular-nums">{reveal.bid.count}</span>{" "}
            ×{" "}
            <span className="font-semibold font-mono tabular-nums">{reveal.bid.face}</span>.
            Actual:{" "}
            <span
              className={`font-display tabular-nums tracking-tight ${actualTintClass}`}
              style={{ fontSize: "1.5rem", fontWeight: 800 }}
            >
              {reveal.actual}
            </span>
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
                      dim={!matches}
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
