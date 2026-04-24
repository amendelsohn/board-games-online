import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOARD_SIZE,
  QUORIDOR_TYPE,
  WALL_GRID_SIZE,
  posEq,
  wallConflicts,
  type Pos,
  type QuoridorConfig,
  type QuoridorMove,
  type QuoridorView,
  type Wall,
  type WallKind,
} from "./shared";

type Tool = "move" | "wall-h" | "wall-v";

const GAP = 6; // px gutter between cells (wall slot)

function QuoridorBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<QuoridorView, QuoridorMove>) {
  const isOver = view.winner !== null;
  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  // Responsive cell sizing — computed from viewport width so mobile (375px)
  // doesn't horizontally-scroll and desktop can use the full comfortable size.
  const [cellPx, setCellPx] = useState(44);
  useEffect(() => {
    const compute = () => {
      const vw = window.innerWidth;
      const maxBoardWidth = Math.min(vw - 32, 560);
      const newCell = Math.floor(
        (maxBoardWidth - (BOARD_SIZE - 1) * GAP) / BOARD_SIZE,
      );
      setCellPx(Math.max(28, Math.min(48, newCell)));
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  const cellTopLeft = (row: number, col: number) => ({
    top: row * (cellPx + GAP),
    left: col * (cellPx + GAP),
  });
  const wallRect = (w: Wall) => {
    if (w.kind === "h") {
      return {
        top: w.row * (cellPx + GAP) + cellPx,
        left: w.col * (cellPx + GAP),
        width: cellPx * 2 + GAP,
        height: GAP,
      };
    }
    return {
      top: w.row * (cellPx + GAP),
      left: w.col * (cellPx + GAP) + cellPx,
      width: GAP,
      height: cellPx * 2 + GAP,
    };
  };
  const size = BOARD_SIZE * cellPx + (BOARD_SIZE - 1) * GAP;
  const pawnPad = Math.round(cellPx * 0.16);

  const [tool, setTool] = useState<Tool>("move");
  const [hoverWall, setHoverWall] = useState<Wall | null>(null);

  const myWallsLeft = view.wallsLeft[me] ?? 0;
  useEffect(() => {
    if ((tool === "wall-h" || tool === "wall-v") && myWallsLeft <= 0) {
      setTool("move");
    }
  }, [tool, myWallsLeft]);

  const [p1, p2] = view.players;
  const p1Pos = view.pos[p1]!;
  const p2Pos = view.pos[p2]!;
  const amP1 = me === p1;
  const myPos = view.pos[me];
  const myLegal: Pos[] = view.legalMoves;

  const p1Goal = BOARD_SIZE - 1;
  const p2Goal = 0;
  const myGoalRow = amP1 ? p1Goal : p2Goal;

  // Last-move highlight tracking
  const lastFrom =
    view.lastMove?.kind === "move" ? view.lastMove.from : null;
  const lastTo = view.lastMove?.kind === "move" ? view.lastMove.to : null;
  const lastWall = view.lastMove?.kind === "wall" ? view.lastMove.wall : null;

  const onCellClick = (row: number, col: number) => {
    if (!isMyTurn || isOver) return;
    if (tool !== "move") return;
    const here = { row, col };
    if (!myLegal.some((p) => posEq(p, here))) return;
    void sendMove({ kind: "move", to: here });
  };

  const onWallClick = (w: Wall) => {
    if (!isMyTurn || isOver) return;
    if (tool === "move") return;
    if (myWallsLeft <= 0) return;
    if (wallConflicts(w, view.walls)) return;
    void sendMove({ kind: "wall", wall: w });
  };

  const hslots: Wall[] = [];
  const vslots: Wall[] = [];
  for (let r = 0; r < WALL_GRID_SIZE; r++) {
    for (let c = 0; c < WALL_GRID_SIZE; c++) {
      hslots.push({ kind: "h", row: r, col: c });
      vslots.push({ kind: "v", row: r, col: c });
    }
  }

  const nameOf = (id: string) => playersById[id]?.name ?? id;

  return (
    <div className="flex flex-col items-center gap-3 sm:gap-4 w-full">
      <StatusBar
        view={view}
        isMyTurn={isMyTurn}
        me={me}
        playersById={playersById}
      />

      <PlayerCards view={view} playersById={playersById} me={me} />

      {!isOver && (
        <div className="inline-flex rounded-full bg-base-200 p-1 ring-1 ring-base-300">
          <ToolBtn
            active={tool === "move"}
            onClick={() => setTool("move")}
            label="Move"
          />
          <ToolBtn
            active={tool === "wall-h"}
            onClick={() => setTool("wall-h")}
            label={
              <span className="flex items-center gap-1.5">
                <svg
                  width="14"
                  height="6"
                  viewBox="0 0 14 6"
                  aria-hidden
                >
                  <rect width="14" height="6" rx="1.5" fill="currentColor" />
                </svg>
                Wall
              </span>
            }
            disabled={myWallsLeft <= 0}
          />
          <ToolBtn
            active={tool === "wall-v"}
            onClick={() => setTool("wall-v")}
            label={
              <span className="flex items-center gap-1.5">
                <svg
                  width="6"
                  height="14"
                  viewBox="0 0 6 14"
                  aria-hidden
                >
                  <rect width="6" height="14" rx="1.5" fill="currentColor" />
                </svg>
                Wall
              </span>
            }
            disabled={myWallsLeft <= 0}
          />
        </div>
      )}

      {/* Board */}
      <div
        className="relative rounded-2xl p-2 sm:p-3"
        style={{
          width: size + 24,
          height: size + 24,
          background:
            "color-mix(in oklch, var(--color-base-300) 75%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
        }}
      >
        <div
          className="relative"
          style={{ width: size, height: size }}
        >
          {/* Cells */}
          {Array.from({ length: BOARD_SIZE }).map((_, row) =>
            Array.from({ length: BOARD_SIZE }).map((__, col) => {
              const { top, left } = cellTopLeft(row, col);
              const isLegal =
                tool === "move" &&
                isMyTurn &&
                !isOver &&
                myLegal.some((p) => p.row === row && p.col === col);
              const isMyPos =
                myPos && myPos.row === row && myPos.col === col;
              const isOppPos =
                !isMyPos &&
                ((p1Pos.row === row && p1Pos.col === col) ||
                  (p2Pos.row === row && p2Pos.col === col));
              const isP1GoalRow = row === p1Goal;
              const isP2GoalRow = row === p2Goal;
              const isMyGoalRow = row === myGoalRow;
              const isLastFrom = !!lastFrom && lastFrom.row === row && lastFrom.col === col;
              const isLastTo = !!lastTo && lastTo.row === row && lastTo.col === col;

              let bg: string | undefined;
              if (isMyPos || isOppPos || isLegal) {
                bg = undefined;
              } else if (isP1GoalRow) {
                bg = `color-mix(in oklch, var(--color-primary) ${isMyGoalRow ? 14 : 9}%, var(--color-base-100))`;
              } else if (isP2GoalRow) {
                bg = `color-mix(in oklch, var(--color-error) ${isMyGoalRow ? 14 : 9}%, var(--color-base-100))`;
              } else {
                bg = "color-mix(in oklch, var(--color-base-100) 90%, transparent)";
              }

              const baseShadow =
                "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -1px 0 oklch(0% 0 0 / 0.15), 0 1px 2px oklch(0% 0 0 / 0.1)";
              const shadow =
                isLastFrom || isLastTo
                  ? "inset 0 0 0 2px color-mix(in oklch, var(--color-primary) 55%, transparent), " +
                    baseShadow
                  : baseShadow;

              return (
                <button
                  key={`${row},${col}`}
                  type="button"
                  className={[
                    "absolute rounded-md transition-all duration-200 flex items-center justify-center",
                    isLegal
                      ? "cursor-pointer"
                      : isMyPos || isOppPos
                        ? ""
                        : "cursor-default",
                  ].join(" ")}
                  onClick={() => onCellClick(row, col)}
                  disabled={!isLegal && !isMyPos && !isOppPos}
                  style={{
                    top,
                    left,
                    width: cellPx,
                    height: cellPx,
                    background: bg,
                    boxShadow: shadow,
                  }}
                  aria-label={`cell ${row},${col}${isLegal ? " (legal move)" : ""}`}
                >
                  {isLegal && (
                    <div
                      aria-hidden
                      style={{
                        width: Math.round(cellPx * 0.35),
                        height: Math.round(cellPx * 0.35),
                        borderRadius: "50%",
                        background:
                          "color-mix(in oklch, var(--color-primary) 60%, transparent)",
                        boxShadow:
                          "0 0 8px color-mix(in oklch, var(--color-primary) 35%, transparent)",
                      }}
                    />
                  )}
                </button>
              );
            }),
          )}

          {/* Pawns */}
          <Pawn
            pos={p1Pos}
            seat={amP1 ? "me-p1" : "them-p1"}
            cellPx={cellPx}
            pad={pawnPad}
            cellTopLeft={cellTopLeft}
          />
          <Pawn
            pos={p2Pos}
            seat={amP1 ? "them-p2" : "me-p2"}
            cellPx={cellPx}
            pad={pawnPad}
            cellTopLeft={cellTopLeft}
          />

          {/* Walls */}
          {view.walls.map((w, i) => {
            const r = wallRect(w);
            const isJustPlaced =
              !!lastWall &&
              lastWall.kind === w.kind &&
              lastWall.row === w.row &&
              lastWall.col === w.col;
            return (
              <div
                key={`w${i}`}
                className={[
                  "absolute rounded-sm",
                  isJustPlaced ? "parlor-win" : "",
                ].join(" ")}
                style={{
                  ...r,
                  background:
                    "color-mix(in oklch, var(--color-warning) 60%, var(--color-base-content))",
                  boxShadow: isJustPlaced
                    ? "inset 0 1px 0 oklch(100% 0 0 / 0.2), 0 2px 6px oklch(0% 0 0 / 0.25), 0 0 12px color-mix(in oklch, var(--color-warning) 55%, transparent)"
                    : "inset 0 1px 0 oklch(100% 0 0 / 0.2), 0 2px 6px oklch(0% 0 0 / 0.25)",
                }}
              />
            );
          })}

          {/* Wall hover/placement overlay */}
          {(tool === "wall-h" || tool === "wall-v") &&
            isMyTurn &&
            !isOver && (
              <>
                {(tool === "wall-h" ? hslots : vslots).map((w) => {
                  const blocked = wallConflicts(w, view.walls);
                  const r = wallRect(w);
                  const isHover =
                    hoverWall &&
                    hoverWall.kind === w.kind &&
                    hoverWall.row === w.row &&
                    hoverWall.col === w.col;
                  const pad = 4;
                  return (
                    <button
                      key={`${w.kind}${w.row}${w.col}`}
                      type="button"
                      className="absolute rounded-sm"
                      style={{
                        top: r.top - pad,
                        left: r.left - pad,
                        width: r.width + pad * 2,
                        height: r.height + pad * 2,
                        background: isHover
                          ? blocked
                            ? "color-mix(in oklch, var(--color-error) 40%, transparent)"
                            : "color-mix(in oklch, var(--color-warning) 55%, transparent)"
                          : "transparent",
                        cursor: blocked ? "not-allowed" : "pointer",
                      }}
                      onMouseEnter={() => setHoverWall(w)}
                      onMouseLeave={() => setHoverWall(null)}
                      onClick={() => {
                        if (!blocked) onWallClick(w);
                      }}
                      aria-label={`${w.kind} wall at ${w.row},${w.col}`}
                    />
                  );
                })}
              </>
            )}
        </div>
      </div>

      {isOver && view.winner && (
        <div
          className="max-w-xl w-full rounded-2xl p-5 flex flex-col gap-2 parlor-fade"
          style={{
            background:
              "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))",
            border:
              "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)",
          }}
        >
          <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
            ◆ Race won ◆
          </div>
          <div
            className="font-display tracking-tight"
            style={{ fontSize: "var(--text-display-sm)" }}
          >
            {view.winner === me
              ? "You reached the edge."
              : `${nameOf(view.winner)} reached the edge.`}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBar({
  view,
  isMyTurn,
  me,
  playersById,
}: {
  view: QuoridorView;
  isMyTurn: boolean;
  me: string;
  playersById: Record<string, { id: string; name: string }>;
}) {
  const isOver = view.winner !== null;
  const currentName = playersById[view.current]?.name ?? view.current;
  return (
    <div
      role="status"
      aria-live="polite"
      className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold"
    >
      {isOver ? (
        view.winner === me ? (
          <span className="text-success font-bold">You reached the edge</span>
        ) : (
          <span>
            <span className="text-base-content font-bold">
              {playersById[view.winner!]?.name ?? view.winner}
            </span>{" "}
            reached the edge
          </span>
        )
      ) : isMyTurn ? (
        <span className="text-primary font-bold">Your turn</span>
      ) : (
        <span>
          Waiting on{" "}
          <span className="text-base-content font-bold">{currentName}</span>
        </span>
      )}
    </div>
  );
}

function PlayerCards({
  view,
  playersById,
  me,
}: {
  view: QuoridorView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {view.players.map((id, idx) => {
        const p = playersById[id] ?? { id, name: id };
        const active = view.current === id && view.winner === null;
        const isMe = id === me;
        const wallsLeft = view.wallsLeft[id] ?? 0;
        const depleted = wallsLeft === 0;
        return (
          <div
            key={id}
            className={[
              "rounded-xl px-3 py-2 flex items-center gap-2 min-w-[160px]",
              "border transition-colors",
              active
                ? "border-primary/55 bg-primary/10"
                : "border-base-300/80 bg-base-100",
            ].join(" ")}
          >
            <PawnGlyph seat={idx === 0 ? "p1" : "p2"} />
            <div className="flex flex-col">
              <div className="flex items-center gap-1">
                <span
                  className={[
                    "text-xs font-semibold truncate max-w-[140px]",
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
              <div
                className={[
                  "text-[10px] uppercase tracking-[0.18em] font-mono tabular-nums",
                  depleted
                    ? "text-warning font-semibold"
                    : "text-base-content/55",
                ].join(" ")}
              >
                {wallsLeft} walls
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PawnGlyph({ seat }: { seat: "p1" | "p2" }) {
  const color =
    seat === "p1" ? "var(--color-primary)" : "var(--color-error)";
  return (
    <div
      style={{
        width: 18,
        height: 24,
        borderRadius: "50% 50% 20% 20% / 60% 60% 20% 20%",
        background: `linear-gradient(180deg, ${color}, color-mix(in oklch, ${color} 70%, black))`,
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -1px 0 oklch(0% 0 0 / 0.3), 0 1px 2px oklch(0% 0 0 / 0.2)",
      }}
    />
  );
}

function Pawn({
  pos,
  seat,
  cellPx,
  pad,
  cellTopLeft,
}: {
  pos: Pos;
  seat: "me-p1" | "me-p2" | "them-p1" | "them-p2";
  cellPx: number;
  pad: number;
  cellTopLeft: (row: number, col: number) => { top: number; left: number };
}) {
  const { top, left } = cellTopLeft(pos.row, pos.col);
  const isP1 = seat === "me-p1" || seat === "them-p1";
  const color = isP1 ? "var(--color-primary)" : "var(--color-error)";
  const ring =
    seat === "me-p1" || seat === "me-p2"
      ? "0 0 0 2px oklch(100% 0 0 / 0.85), 0 0 0 4px color-mix(in oklch, var(--color-primary) 55%, transparent)"
      : "0 0 0 2px oklch(100% 0 0 / 0.75)";
  return (
    <div
      className="absolute pointer-events-none transition-all"
      style={{
        top: top + pad,
        left: left + pad,
        width: cellPx - pad * 2,
        height: cellPx - pad * 2,
        borderRadius: "50% 50% 28% 28% / 60% 60% 30% 30%",
        background: `radial-gradient(circle at 30% 30%, color-mix(in oklch, ${color} 90%, white) 0%, ${color} 60%, color-mix(in oklch, ${color} 55%, black) 100%)`,
        boxShadow: `${ring}, inset 0 1px 0 oklch(100% 0 0 / 0.35), inset 0 -2px 4px oklch(0% 0 0 / 0.35), 0 2px 6px oklch(0% 0 0 / 0.3)`,
        transitionProperty: "top, left",
        transitionDuration: "220ms",
      }}
    />
  );
}

function ToolBtn({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95",
        active
          ? "bg-primary text-primary-content shadow"
          : disabled
            ? "text-base-content/30 cursor-not-allowed"
            : "text-base-content/70 hover:text-base-content",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export const quoridorClientModule: ClientGameModule<
  QuoridorView,
  QuoridorMove,
  QuoridorConfig
> = {
  type: QUORIDOR_TYPE,
  Board: QuoridorBoard,
};

export type { WallKind };
