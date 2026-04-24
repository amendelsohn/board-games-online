import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  REVERSI_TYPE,
  SIZE,
  type Cell,
  type ReversiMove,
  type ReversiView,
} from "./shared";

function discColor(disc: "B" | "W"): string {
  return disc === "B" ? "var(--color-primary)" : "var(--color-secondary)";
}

function ReversiBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<ReversiView, ReversiMove>) {
  const myDisc = view.colors[me];
  const isOver = view.winner !== null || view.isDraw;
  const legal = new Set(view.legalMoves);

  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);
  const blackPid =
    Object.entries(view.colors).find(([, d]) => d === "B")?.[0] ?? null;
  const whitePid =
    Object.entries(view.colors).find(([, d]) => d === "W")?.[0] ?? null;
  const nameOf = (id: string | null | undefined) =>
    (id && playersById[id]?.name) ?? "Player";

  // Track cells that changed — split into "placed" (null → disc) vs
  // "flipped" (one disc → other) for distinct animations.
  const prevCellsRef = useRef<readonly Cell[]>(view.cells);
  const [placed, setPlaced] = useState<Set<number>>(new Set());
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  useEffect(() => {
    const prev = prevCellsRef.current;
    const p = new Set<number>();
    const f = new Set<number>();
    for (let i = 0; i < view.cells.length; i++) {
      if (prev[i] !== view.cells[i]) {
        if (prev[i] === null && view.cells[i] !== null) p.add(i);
        else if (prev[i] !== null && view.cells[i] !== null) f.add(i);
      }
    }
    prevCellsRef.current = view.cells;
    if (p.size > 0 || f.size > 0) {
      setPlaced(p);
      setFlipped(f);
      const t = setTimeout(() => {
        setPlaced(new Set());
        setFlipped(new Set());
      }, 500);
      return () => clearTimeout(t);
    }
  }, [view.cells]);

  const handleClick = (row: number, col: number) => {
    if (!isMyTurn || isOver) return;
    const idx = row * SIZE + col;
    if (!legal.has(idx)) return;
    void sendMove({ kind: "place", row, col });
  };

  const scoreLead = (() => {
    const diff = view.scores.B - view.scores.W;
    if (diff === 0) return null;
    const leaderDisc = diff > 0 ? "B" : "W";
    const leaderPid = leaderDisc === "B" ? blackPid : whitePid;
    const delta = Math.abs(diff);
    return { leaderDisc, leaderPid, delta };
  })();

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <style>{`
        @keyframes reversi-flip {
          0%   { transform: rotateY(0deg); }
          50%  { transform: rotateY(90deg) scale(0.92); filter: brightness(0.85); }
          100% { transform: rotateY(0deg); }
        }
        .reversi-flip { animation: reversi-flip 420ms cubic-bezier(0.22, 1, 0.36, 1); transform-style: preserve-3d; }
        @keyframes reversi-dot-pulse {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50%      { opacity: 0.95; transform: scale(1.1); }
        }
        .reversi-dot-pulse { animation: reversi-dot-pulse 1.6s ease-in-out infinite; }
      `}</style>

      {/* Player cards */}
      <div className="flex gap-2 flex-wrap justify-center">
        {(["B", "W"] as const).map((disc) => {
          const pid = disc === "B" ? blackPid : whitePid;
          const active = pid === view.current && !isOver;
          const isMe = pid === me;
          const score = view.scores[disc];
          return (
            <div
              key={disc}
              className={[
                "rounded-xl px-3 py-2 flex items-center gap-2 min-w-[140px] border transition-colors",
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-base-300/80 bg-base-100",
              ].join(" ")}
            >
              <span
                className="inline-block h-5 w-5 rounded-full shrink-0"
                style={{
                  background: discColor(disc),
                  boxShadow:
                    "inset 0 -1px 0 oklch(0% 0 0 / 0.25), inset 0 1px 0 oklch(100% 0 0 / 0.3), 0 1px 2px oklch(0% 0 0 / 0.25)",
                }}
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-xs font-semibold truncate max-w-[120px] ${active ? "text-primary" : ""}`}
                  >
                    {nameOf(pid)}
                  </span>
                  {isMe && (
                    <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/50">
                      you
                    </span>
                  )}
                </div>
                <span className="text-xl font-display font-bold tabular-nums leading-none">
                  {score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Score delta */}
      {!isOver && blackPid && whitePid && (
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 font-mono">
          {scoreLead === null ? (
            <span className="text-base-content/70">Tied</span>
          ) : (
            <>
              <span
                className={
                  scoreLead.leaderPid === me
                    ? "text-success font-bold"
                    : "text-base-content/80 font-bold"
                }
              >
                {scoreLead.leaderPid === me
                  ? "You"
                  : nameOf(scoreLead.leaderPid)}
              </span>
              <span> +{scoreLead.delta} ahead</span>
            </>
          )}
        </div>
      )}

      <div
        className="relative rounded-2xl p-3 md:p-4"
        style={{
          background:
            "color-mix(in oklch, var(--color-success) 55%, var(--color-base-300))",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -2px 0 oklch(0% 0 0 / 0.18), 0 16px 40px color-mix(in oklch, var(--color-success) 20%, transparent)",
        }}
      >
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: SIZE * SIZE }).map((_, i) => {
            const row = Math.floor(i / SIZE);
            const col = i % SIZE;
            const cell = view.cells[i] ?? null;
            const isLegal = !isOver && isMyTurn && legal.has(i);
            const isLast =
              view.lastMove &&
              view.lastMove.row === row &&
              view.lastMove.col === col;
            const wasPlaced = placed.has(i) && cell !== null;
            const wasFlipped = flipped.has(i) && cell !== null;
            const clickable = isLegal;
            const isCorner =
              (row === 0 || row === 7) && (col === 0 || col === 7);

            return (
              <button
                key={i}
                type="button"
                disabled={!clickable}
                onClick={() => handleClick(row, col)}
                className={[
                  "relative h-10 w-10 md:h-11 md:w-11 rounded-md",
                  "flex items-center justify-center",
                  clickable ? "cursor-pointer" : "cursor-default",
                  "transition-transform duration-150",
                  clickable ? "hover:scale-[1.04]" : "",
                ].join(" ")}
                style={{
                  background:
                    "color-mix(in oklch, oklch(0% 0 0) 12%, transparent)",
                  boxShadow:
                    "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.22)",
                }}
                aria-label={`${String.fromCharCode(65 + col)}${row + 1}${cell ? ` ${cell === "B" ? "black" : "white"}` : ""}${isLegal ? " (legal)" : ""}`}
              >
                {/* Bottom-row letter label */}
                {row === 7 && (
                  <span
                    aria-hidden
                    className="absolute bottom-0.5 right-1 text-[8px] tracking-wider font-mono"
                    style={{
                      color:
                        "color-mix(in oklch, var(--color-base-100) 65%, transparent)",
                    }}
                  >
                    {String.fromCharCode(65 + col)}
                  </span>
                )}
                {/* Left-column rank label */}
                {col === 0 && (
                  <span
                    aria-hidden
                    className="absolute top-0.5 left-1 text-[8px] tracking-wider font-mono"
                    style={{
                      color:
                        "color-mix(in oklch, var(--color-base-100) 65%, transparent)",
                    }}
                  >
                    {row + 1}
                  </span>
                )}

                {/* Corner dimple when empty */}
                {isCorner && cell === null && (
                  <span
                    aria-hidden
                    className="absolute w-1 h-1 rounded-full"
                    style={{
                      background:
                        "color-mix(in oklch, oklch(0 0 0) 28%, transparent)",
                      top: row === 0 ? 3 : undefined,
                      bottom: row === 7 ? 3 : undefined,
                      left: col === 0 ? 3 : undefined,
                      right: col === 7 ? 3 : undefined,
                    }}
                  />
                )}

                {cell !== null && (
                  <span
                    className={[
                      "block h-[82%] w-[82%] rounded-full",
                      wasPlaced ? "parlor-drop" : "",
                      wasFlipped ? "reversi-flip" : "",
                      isCorner ? "ring-1 ring-warning/70" : "",
                    ].join(" ")}
                    style={{
                      background: discColor(cell),
                      boxShadow: isLast
                        ? "0 0 0 2px oklch(100% 0 0 / 0.85), 0 0 0 4px color-mix(in oklch, var(--color-base-content) 40%, transparent), inset 0 -2px 0 oklch(0% 0 0 / 0.25), inset 0 2px 0 oklch(100% 0 0 / 0.22), 0 2px 4px oklch(0% 0 0 / 0.25)"
                        : "inset 0 -2px 0 oklch(0% 0 0 / 0.25), inset 0 2px 0 oklch(100% 0 0 / 0.22), 0 2px 4px oklch(0% 0 0 / 0.25)",
                    }}
                  />
                )}
                {cell === null && isLegal && (
                  <span
                    className={[
                      "block h-[28%] w-[28%] rounded-full",
                      isMyTurn ? "reversi-dot-pulse" : "parlor-fade",
                    ].join(" ")}
                    style={{
                      background: myDisc
                        ? `color-mix(in oklch, ${discColor(myDisc)} 55%, transparent)`
                        : "oklch(100% 0 0 / 0.4)",
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {isOver ? (
        <div
          className="max-w-lg w-full rounded-2xl p-5 flex flex-col gap-1 parlor-fade"
          style={{
            background: view.isDraw
              ? "color-mix(in oklch, var(--color-warning) 14%, var(--color-base-100))"
              : view.winner === me
                ? "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))"
                : "color-mix(in oklch, var(--color-base-content) 8%, var(--color-base-100))",
            border: view.isDraw
              ? "1px solid color-mix(in oklch, var(--color-warning) 40%, transparent)"
              : view.winner === me
                ? "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)"
                : "1px solid color-mix(in oklch, var(--color-base-content) 20%, transparent)",
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
            ◆ Final ◆
          </div>
          <div
            className="font-display tracking-tight"
            style={{ fontSize: "var(--text-display-sm)" }}
          >
            {view.isDraw
              ? "Draw — even count."
              : view.winner === me
                ? "You win."
                : `${nameOf(view.winner)} wins.`}
          </div>
          <div className="text-sm text-base-content/60 tabular-nums font-mono">
            {view.scores.B}–{view.scores.W}{" "}
            <span className="text-base-content/45">(Black–White)</span>
          </div>
        </div>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="text-xs text-base-content/55 tracking-wide min-h-[1.2em]"
        >
          {isMyTurn
            ? view.legalMoves.length > 0
              ? "Your move — dots mark legal squares."
              : "No moves — turn passed."
            : `Waiting on ${nameOf(view.current)}`}
        </div>
      )}
    </div>
  );
}

export const reversiClientModule: ClientGameModule<
  ReversiView,
  ReversiMove,
  Record<string, never>
> = {
  type: REVERSI_TYPE,
  Board: ReversiBoard,
};
