import { useEffect, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  MANCALA_TYPE,
  PITS_PER_SIDE,
  pitIndex,
  storeIndex,
  type MancalaMove,
  type MancalaView,
  type Side,
} from "./shared";

/** Deterministic pseudo-random placement of stone dots inside a pit circle. */
function stoneDots(count: number, seed: number): { x: number; y: number }[] {
  const dots: { x: number; y: number }[] = [];
  let s = (seed * 9301 + 49297) & 0xffff;
  const rand = () => {
    s = (s * 9301 + 49297) & 0xffff;
    return s / 0xffff;
  };
  const shown = Math.min(count, 10);
  for (let i = 0; i < shown; i++) {
    const r = 0.28 + rand() * 0.42;
    const a = rand() * Math.PI * 2;
    dots.push({ x: 0.5 + r * Math.cos(a) * 0.5, y: 0.5 + r * Math.sin(a) * 0.5 });
  }
  return dots;
}

function MancalaBoard({
  view,
  me,
  isMyTurn,
  sendMove,
  players,
}: BoardProps<MancalaView, MancalaMove>) {
  const mySide: Side | null = view.sides[me] ?? null;
  const isOver = view.winner !== null || view.isDraw;

  const bottomSide: Side = mySide ?? "A";
  const topSide: Side = bottomSide === "A" ? "B" : "A";

  const bottomPlayerId = view.players.find((id) => view.sides[id] === bottomSide)!;
  const topPlayerId = view.players.find((id) => view.sides[id] === topSide)!;

  const playerName = (id: string) =>
    players.find((p) => p.id === id)?.name ?? id.slice(0, 6);

  const bottomStore = view.board[storeIndex(bottomSide)] ?? 0;
  const topStore = view.board[storeIndex(topSide)] ?? 0;

  const bottomPits: number[] = [];
  const topPits: number[] = [];
  for (let n = 0; n < PITS_PER_SIDE; n++) {
    bottomPits.push(pitIndex(bottomSide, n));
    topPits.push(pitIndex(topSide, n));
  }
  const topPitsVisual = topPits.slice().reverse();

  const iAmBottomPlayer = mySide === bottomSide;
  const myTurnHere = isMyTurn && !isOver && iAmBottomPlayer;

  // ------------------------- Move / capture feedback beats -------------------------

  // Pickup pulse: when lastMove.pit changes, scale the emptied pit briefly.
  const prevLastMovePit = useRef<number | null>(view.lastMove?.pit ?? null);
  const [pickupPulse, setPickupPulse] = useState<number | null>(null);
  useEffect(() => {
    const now = view.lastMove?.pit ?? null;
    if (now !== null && now !== prevLastMovePit.current) {
      setPickupPulse(now);
      const t = setTimeout(() => setPickupPulse(null), 340);
      prevLastMovePit.current = now;
      return () => clearTimeout(t);
    }
    prevLastMovePit.current = now;
  }, [view.lastMove?.pit]);

  // Extra-turn detection: transition "not me" -> "me" while lastMove was by me
  // implies I just landed in my store and kept the turn.
  const prevCurrent = useRef<string>(view.current);
  const [extraTurn, setExtraTurn] = useState(false);
  useEffect(() => {
    const prev = prevCurrent.current;
    prevCurrent.current = view.current;
    if (
      !isOver &&
      prev === me &&
      view.current === me &&
      view.lastMove?.by === me
    ) {
      setExtraTurn(true);
      const t = setTimeout(() => setExtraTurn(false), 1600);
      return () => clearTimeout(t);
    }
  }, [view.current, view.lastMove?.by, me, isOver]);

  // Capture detection: track lastCaptured identity + derive captured count
  // from the board delta between the previous and current state.
  const prevBoard = useRef<number[]>(view.board);
  const prevLastCapturedPit = useRef<number | null>(view.lastCaptured?.pit ?? null);
  const [captureBeat, setCaptureBeat] = useState<
    { side: Side; count: number; capturedPit: number } | null
  >(null);
  useEffect(() => {
    const capNow = view.lastCaptured;
    const capPrevPit = prevLastCapturedPit.current;
    prevLastCapturedPit.current = capNow?.pit ?? null;
    const boardBefore = prevBoard.current;
    prevBoard.current = view.board;

    if (!capNow) return;
    if (capNow.pit === capPrevPit) return; // no new capture event

    // Count: stones missing from (pickupPit + capturedPit) between before/after boards.
    const picked = Math.max(0, (boardBefore[capNow.pickupPit] ?? 0) - (view.board[capNow.pickupPit] ?? 0));
    const capturedSide = bleedingSide(capNow.pit);
    const capturer: Side = capturedSide === "A" ? "B" : "A";
    // The capturing side is opposite of the captured pit's side — they moved
    // from their own pit into the final slot on the opposing row.
    // Count stones that were in the captured pit before (all swept into the
    // capturer's store, plus 1 from the final-landing stone).
    const sweptFromOpposite = boardBefore[capNow.pit] ?? 0;
    // Captured total ≈ stones that ended up in the capturer's store from
    // this event: swept opponent pit + 1 from the landing stone on capturer's
    // side. We just show `sweptFromOpposite + 1` as a reasonable estimate;
    // exact count requires a server field.
    const estimated = sweptFromOpposite + (picked > 0 ? 1 : 0);

    setCaptureBeat({
      side: capturer,
      count: estimated,
      capturedPit: capNow.pit,
    });
    const t = setTimeout(() => setCaptureBeat(null), 1600);
    return () => clearTimeout(t);
  }, [view.lastCaptured, view.board]);

  const handleSow = (relPit: number) => {
    if (!myTurnHere) return;
    const abs = pitIndex(bottomSide, relPit);
    if ((view.board[abs] ?? 0) <= 0) return;
    void sendMove({ kind: "sow", pitIndex: relPit });
  };

  const turnLabel = isOver
    ? view.isDraw
      ? "Draw"
      : view.winner === me
        ? "You won"
        : `${playerName(view.winner!)} won`
    : view.current === me
      ? "Your turn"
      : `${playerName(view.current)} to move`;

  const renderPit = (
    slot: number,
    opts: {
      clickable: boolean;
      relIndex: number | null;
      isLast: boolean;
      isCapture: boolean;
      isPickup: boolean;
    },
  ) => {
    const count = view.board[slot] ?? 0;
    const dots = stoneDots(count, slot * 101 + count);
    const ring = opts.isCapture
      ? "ring-2 ring-success parlor-win"
      : opts.isPickup
        ? "ring-2 ring-primary/55"
        : opts.isLast
          ? "ring-2 ring-base-100/70"
          : "";
    const clickable = opts.clickable && count > 0;
    const isPulsing = pickupPulse === slot;
    return (
      <div key={slot} className="relative">
        <button
          type="button"
          disabled={!clickable}
          onClick={() => opts.relIndex !== null && handleSow(opts.relIndex)}
          className={[
            "relative rounded-full flex items-center justify-center",
            // Pit base — sized to fit all six + two stores at 375px.
            "h-11 w-11 sm:h-14 sm:w-14 md:h-20 md:w-20",
            "transition-transform duration-150",
            clickable ? "hover:scale-[1.05] cursor-pointer" : "cursor-default",
            ring,
          ].join(" ")}
          style={{
            background:
              "color-mix(in oklch, var(--color-base-100) 80%, var(--color-primary) 8%)",
            boxShadow:
              "inset 0 3px 6px oklch(0% 0 0 / 0.25), inset 0 -1px 0 oklch(100% 0 0 / 0.12)",
            animation: isPulsing
              ? "mancala-pickup 340ms ease-out"
              : undefined,
          }}
          aria-label={
            opts.relIndex !== null
              ? `your pit ${opts.relIndex + 1} with ${count} stones`
              : `opponent pit with ${count} stones`
          }
        >
          <div className="absolute inset-0 pointer-events-none">
            {dots.map((d, i) => (
              <span
                key={i}
                className="absolute rounded-full"
                style={{
                  left: `${d.x * 100}%`,
                  top: `${d.y * 100}%`,
                  width: "14%",
                  height: "14%",
                  transform: "translate(-50%, -50%)",
                  background:
                    "radial-gradient(circle at 35% 30%, color-mix(in oklch, var(--color-warning) 85%, white) 0%, var(--color-warning) 60%, color-mix(in oklch, var(--color-warning) 70%, black) 100%)",
                  boxShadow: "0 1px 1px oklch(0% 0 0 / 0.35)",
                }}
              />
            ))}
          </div>
          <span
            className="relative z-10 font-display font-bold text-sm sm:text-base md:text-lg tabular-nums"
            style={{
              color: "var(--color-base-content)",
              textShadow:
                "0 1px 2px color-mix(in oklch, var(--color-base-100) 70%, transparent)",
            }}
          >
            {count}
          </span>
        </button>
        {/* Bottom-row pit label (1..6) — player-facing only */}
        {opts.relIndex !== null && (
          <span
            aria-hidden
            className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[9px] font-mono text-base-content/40 tabular-nums leading-none"
          >
            {opts.relIndex + 1}
          </span>
        )}
      </div>
    );
  };

  const lastSlot = view.lastMove?.pit ?? null;
  const capturePit = view.lastCaptured?.pit ?? null;
  const pickupPit = view.lastCaptured?.pickupPit ?? null;

  const renderStore = (side: Side, count: number, alignRight: boolean) => {
    const isCapturing = captureBeat?.side === side;
    const isMine = side === bottomSide;
    return (
      <div
        className={[
          "relative flex flex-col items-center justify-center rounded-full",
          "h-24 w-14 sm:h-36 sm:w-20 md:h-44 md:w-24",
          "parlor-rise",
        ].join(" ")}
        style={{
          background:
            "color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100))",
          boxShadow:
            "inset 0 4px 10px oklch(0% 0 0 / 0.3), inset 0 -2px 0 oklch(100% 0 0 / 0.12)",
          animation: isCapturing
            ? "mancala-store-pop 500ms ease-out"
            : extraTurn && isMine
              ? "mancala-store-breathe 1200ms ease-in-out 1"
              : undefined,
        }}
        aria-label={`${side} store with ${count} stones`}
      >
        <div
          className="text-[9px] sm:text-[10px] md:text-[11px] uppercase tracking-[0.22em] font-semibold"
          style={{ color: "color-mix(in oklch, var(--color-base-content) 55%, transparent)" }}
        >
          {alignRight ? "Your store" : "Opponent"}
        </div>
        <div
          className="font-display font-bold text-2xl sm:text-3xl md:text-4xl tabular-nums"
          style={{ color: "var(--color-base-content)" }}
        >
          {count}
        </div>
        {isCapturing && captureBeat && (
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold font-display tabular-nums"
            style={{
              background: "var(--color-warning)",
              color: "var(--color-warning-content, oklch(20% 0.02 60))",
              boxShadow: "0 2px 6px color-mix(in oklch, var(--color-warning) 40%, transparent)",
              animation: "mancala-chip-float 1500ms ease-out forwards",
            }}
          >
            +{captureBeat.count}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <style>{`
        @keyframes mancala-pickup {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes mancala-store-pop {
          0%   { transform: scale(1); }
          30%  { transform: scale(1.08); }
          60%  { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        @keyframes mancala-store-breathe {
          0%, 100% { box-shadow: inset 0 4px 10px oklch(0% 0 0 / 0.3), inset 0 -2px 0 oklch(100% 0 0 / 0.12); }
          50%      { box-shadow: inset 0 4px 10px oklch(0% 0 0 / 0.3), inset 0 -2px 0 oklch(100% 0 0 / 0.12), 0 0 24px color-mix(in oklch, var(--color-warning) 50%, transparent); }
        }
        @keyframes mancala-chip-float {
          0%   { transform: translate(-50%, 0) scale(0.8); opacity: 0; }
          15%  { transform: translate(-50%, -6px) scale(1.06); opacity: 1; }
          70%  { transform: translate(-50%, -14px) scale(1); opacity: 1; }
          100% { transform: translate(-50%, -22px) scale(0.95); opacity: 0; }
        }
      `}</style>
      <div className="flex items-center gap-6 text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold font-mono tabular-nums">
        <span>
          {playerName(topPlayerId)}:{" "}
          <span className="text-base-content">{topStore}</span>
        </span>
        <span className="text-base-content/40">vs</span>
        <span>
          {iAmBottomPlayer ? "You" : playerName(bottomPlayerId)}:{" "}
          <span className="text-base-content">{bottomStore}</span>
        </span>
      </div>

      <div
        className="text-xs uppercase tracking-[0.22em] font-semibold"
        style={{
          color: isOver
            ? "var(--color-success)"
            : view.current === me
              ? "var(--color-primary)"
              : "color-mix(in oklch, var(--color-base-content) 55%, transparent)",
        }}
      >
        {turnLabel}
      </div>

      {extraTurn && !isOver && (
        <div
          className="text-[11px] uppercase tracking-[0.28em] font-bold parlor-fade"
          style={{ color: "var(--color-warning)" }}
        >
          ◆ Extra turn — go again ◆
        </div>
      )}

      <div
        className="rounded-[2rem] p-3 sm:p-4 md:p-5 max-w-full"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklch, var(--color-primary) 45%, var(--color-base-300)) 0%, color-mix(in oklch, var(--color-primary) 30%, var(--color-base-300)) 100%)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -3px 0 oklch(0% 0 0 / 0.2), 0 16px 32px color-mix(in oklch, var(--color-primary) 25%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          {renderStore(topSide, topStore, false)}

          <div className="flex flex-col gap-2 sm:gap-2.5 md:gap-3">
            <div className="flex gap-1.5 sm:gap-2 md:gap-3">
              {topPitsVisual.map((slot) =>
                renderPit(slot, {
                  clickable: false,
                  relIndex: null,
                  isLast: slot === lastSlot,
                  isCapture: slot === capturePit,
                  isPickup: slot === pickupPit,
                }),
              )}
            </div>
            <div className="flex gap-1.5 sm:gap-2 md:gap-3 pb-3">
              {bottomPits.map((slot, rel) =>
                renderPit(slot, {
                  clickable: myTurnHere,
                  relIndex: rel,
                  isLast: slot === lastSlot,
                  isCapture: slot === capturePit,
                  isPickup: slot === pickupPit,
                }),
              )}
            </div>
          </div>

          {renderStore(bottomSide, bottomStore, true)}
        </div>
      </div>

      <div className="text-xs text-base-content/50 tracking-wide text-center max-w-md px-4">
        {isOver
          ? view.isDraw
            ? "Tied score — honorable draw."
            : "Game over."
          : iAmBottomPlayer
            ? "Tap one of your pits to sow stones counter-clockwise."
            : "Waiting for the other player."}
      </div>
    </div>
  );
}

function bleedingSide(pit: number): Side {
  return pit <= 5 ? "A" : "B";
}

export const mancalaClientModule: ClientGameModule<
  MancalaView,
  MancalaMove,
  Record<string, never>
> = {
  type: MANCALA_TYPE,
  Board: MancalaBoard,
};
