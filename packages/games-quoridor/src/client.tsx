import { useEffect, useMemo, useState } from "react";
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

const CELL = 44; // px
const GAP = 6; // px gutter between cells (wall slot)

function boardPx() {
  return BOARD_SIZE * CELL + (BOARD_SIZE - 1) * GAP;
}

function cellTopLeft(row: number, col: number) {
  return {
    top: row * (CELL + GAP),
    left: col * (CELL + GAP),
  };
}

function wallRect(w: Wall) {
  // Walls sit in the gutter between cells.
  if (w.kind === "h") {
    // Horizontal wall between row w.row and row w.row+1, spanning col w.col..w.col+1
    return {
      top: w.row * (CELL + GAP) + CELL,
      left: w.col * (CELL + GAP),
      width: CELL * 2 + GAP,
      height: GAP,
    };
  }
  // Vertical wall between col w.col and col w.col+1, spanning row w.row..w.row+1
  return {
    top: w.row * (CELL + GAP),
    left: w.col * (CELL + GAP) + CELL,
    width: GAP,
    height: CELL * 2 + GAP,
  };
}

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

  const [tool, setTool] = useState<Tool>("move");
  const [hoverWall, setHoverWall] = useState<Wall | null>(null);

  // If we flip to wall tool with no walls left, snap back to move.
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

  const size = boardPx();

  // Build all possible wall slot positions for hover/preview during wall modes.
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
    <div className="flex flex-col items-center gap-4 w-full">
      <StatusBar
        view={view}
        isMyTurn={isMyTurn}
        me={me}
        playersById={playersById}
      />

      <PlayerCards
        view={view}
        playersById={playersById}
        me={me}
      />

      {/* Tool toggle */}
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
            label="─ Wall"
            disabled={myWallsLeft <= 0}
          />
          <ToolBtn
            active={tool === "wall-v"}
            onClick={() => setTool("wall-v")}
            label="│ Wall"
            disabled={myWallsLeft <= 0}
          />
        </div>
      )}

      {/* Board */}
      <div
        className="relative rounded-2xl p-3"
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
              return (
                <button
                  key={`${row},${col}`}
                  type="button"
                  className={[
                    "absolute rounded-md transition-all duration-200",
                    "flex items-center justify-center",
                    isLegal
                      ? "cursor-pointer ring-2 ring-primary bg-primary/15"
                      : isMyPos || isOppPos
                        ? ""
                        : "cursor-default",
                  ].join(" ")}
                  onClick={() => onCellClick(row, col)}
                  disabled={
                    !isLegal && !isMyPos && !isOppPos
                  }
                  style={{
                    top,
                    left,
                    width: CELL,
                    height: CELL,
                    background:
                      isMyPos || isOppPos
                        ? undefined
                        : isLegal
                          ? undefined
                          : "color-mix(in oklch, var(--color-base-100) 90%, transparent)",
                    boxShadow:
                      "inset 0 1px 0 oklch(100% 0 0 / 0.2), inset 0 -1px 0 oklch(0% 0 0 / 0.15), 0 1px 2px oklch(0% 0 0 / 0.1)",
                  }}
                  aria-label={`cell ${row},${col}`}
                />
              );
            }),
          )}

          {/* Pawns */}
          <Pawn pos={p1Pos} seat={amP1 ? "me-p1" : "them-p1"} />
          <Pawn pos={p2Pos} seat={amP1 ? "them-p2" : "me-p2"} />

          {/* Walls */}
          {view.walls.map((w, i) => {
            const r = wallRect(w);
            return (
              <div
                key={`w${i}`}
                className="absolute rounded-sm"
                style={{
                  ...r,
                  background:
                    "color-mix(in oklch, var(--color-warning) 60%, var(--color-base-content))",
                  boxShadow:
                    "inset 0 1px 0 oklch(100% 0 0 / 0.2), 0 2px 6px oklch(0% 0 0 / 0.25)",
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
                  // Expand the hit area by padding the slot a bit.
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
        <div className="text-sm text-base-content/80">
          <span className="font-semibold text-success">
            {nameOf(view.winner)}
          </span>{" "}
          reached the far side.
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
    <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
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
              <div className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
                {view.wallsLeft[id] ?? 0} walls
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
}: {
  pos: Pos;
  seat: "me-p1" | "me-p2" | "them-p1" | "them-p2";
}) {
  const { top, left } = cellTopLeft(pos.row, pos.col);
  const isP1 = seat === "me-p1" || seat === "them-p1";
  const color = isP1 ? "var(--color-primary)" : "var(--color-error)";
  const ring =
    seat === "me-p1" || seat === "me-p2"
      ? "0 0 0 2px oklch(100% 0 0 / 0.85), 0 0 0 4px color-mix(in oklch, var(--color-primary) 55%, transparent)"
      : "0 0 0 2px oklch(100% 0 0 / 0.75)";
  const pad = 7;
  return (
    <div
      className="absolute pointer-events-none transition-all"
      style={{
        top: top + pad,
        left: left + pad,
        width: CELL - pad * 2,
        height: CELL - pad * 2,
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
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
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

// Re-export for completeness; not strictly needed elsewhere.
export type { WallKind };
