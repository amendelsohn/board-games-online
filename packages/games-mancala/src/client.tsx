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
  // Hash seed into a small LCG so placements are stable across renders.
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

  // Determine which player is "top" (opponent) and "bottom" (me, or viewer POV).
  // Spectators fall back to A on bottom, B on top.
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
  // Top row is drawn from leftmost to rightmost as the VIEWER sees it, which
  // means we reverse the opponent's pits (their pit 0 is at their left = our right).
  const topPitsVisual = topPits.slice().reverse();

  const iAmBottomPlayer = mySide === bottomSide;
  const myTurnHere = isMyTurn && !isOver && iAmBottomPlayer;

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
    opts: { clickable: boolean; relIndex: number | null; isLast: boolean; isCapture: boolean; isPickup: boolean },
  ) => {
    const count = view.board[slot] ?? 0;
    const dots = stoneDots(count, slot * 101 + count);
    const ring = opts.isCapture
      ? "ring-2 ring-success parlor-win"
      : opts.isPickup
        ? "ring-2 ring-error"
        : opts.isLast
          ? "ring-2 ring-base-100/70"
          : "";
    const clickable = opts.clickable && count > 0;
    return (
      <button
        key={slot}
        type="button"
        disabled={!clickable}
        onClick={() => opts.relIndex !== null && handleSow(opts.relIndex)}
        className={[
          "relative h-16 w-16 md:h-20 md:w-20 rounded-full flex items-center justify-center",
          "transition-transform duration-150",
          clickable ? "hover:scale-[1.05] cursor-pointer" : "cursor-default",
          ring,
        ].join(" ")}
        style={{
          background:
            "color-mix(in oklch, var(--color-base-100) 80%, var(--color-primary) 8%)",
          boxShadow:
            "inset 0 3px 6px oklch(0% 0 0 / 0.25), inset 0 -1px 0 oklch(100% 0 0 / 0.12)",
        }}
        aria-label={`pit ${slot} with ${count} stones`}
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
          className="relative z-10 font-display font-bold text-base md:text-lg"
          style={{
            color: "var(--color-base-content)",
            textShadow:
              "0 1px 2px color-mix(in oklch, var(--color-base-100) 70%, transparent)",
          }}
        >
          {count}
        </span>
      </button>
    );
  };

  const lastSlot = view.lastMove?.pit ?? null;
  const capturePit = view.lastCaptured?.pit ?? null;
  const pickupPit = view.lastCaptured?.pickupPit ?? null;

  const renderStore = (side: Side, count: number, alignRight: boolean) => (
    <div
      className={[
        "flex flex-col items-center justify-center",
        "h-36 md:h-44 w-20 md:w-24 rounded-full",
        "parlor-rise",
      ].join(" ")}
      style={{
        background:
          "color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100))",
        boxShadow:
          "inset 0 4px 10px oklch(0% 0 0 / 0.3), inset 0 -2px 0 oklch(100% 0 0 / 0.12)",
      }}
      aria-label={`${side} store with ${count} stones`}
    >
      <div
        className="text-[0.65rem] uppercase tracking-[0.22em] font-semibold"
        style={{ color: "color-mix(in oklch, var(--color-base-content) 55%, transparent)" }}
      >
        {alignRight ? "Your store" : "Opponent"}
      </div>
      <div
        className="font-display font-bold text-3xl md:text-4xl"
        style={{ color: "var(--color-base-content)" }}
      >
        {count}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-6 text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        <span>
          {playerName(topPlayerId)}: <span className="text-base-content">{topStore}</span>
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

      <div
        className="rounded-[2rem] p-4 md:p-5"
        style={{
          background:
            "linear-gradient(180deg, color-mix(in oklch, var(--color-primary) 45%, var(--color-base-300)) 0%, color-mix(in oklch, var(--color-primary) 30%, var(--color-base-300)) 100%)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -3px 0 oklch(0% 0 0 / 0.2), 0 16px 32px color-mix(in oklch, var(--color-primary) 25%, transparent)",
        }}
      >
        <div className="flex items-center gap-3 md:gap-4">
          {/* Opponent store — on the left of the board from viewer's POV */}
          {renderStore(topSide, topStore, false)}

          <div className="flex flex-col gap-3">
            {/* Top row — opponent's pits, drawn left-to-right as viewer sees them */}
            <div className="flex gap-2 md:gap-3">
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
            {/* Bottom row — viewer's own pits, drawn left-to-right (rel 0 leftmost) */}
            <div className="flex gap-2 md:gap-3">
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

          {/* Viewer's store — on the right */}
          {renderStore(bottomSide, bottomStore, true)}
        </div>
      </div>

      <div className="text-xs text-base-content/50 tracking-wide">
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

export const mancalaClientModule: ClientGameModule<
  MancalaView,
  MancalaMove,
  Record<string, never>
> = {
  type: MANCALA_TYPE,
  Board: MancalaBoard,
};
