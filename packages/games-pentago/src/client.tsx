import { useMemo, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  BOARD_SIZE,
  PENTAGO_TYPE,
  idx,
  type PentagoConfig,
  type PentagoMove,
  type PentagoView,
  type Quadrant,
  type Rotation,
  type Stone,
} from "./shared";

// ------------------------- Stone visual -------------------------

function StoneVisual({
  stone,
  size = 36,
  highlight = false,
  ghost = false,
}: {
  stone: Stone | null;
  size?: number;
  highlight?: boolean;
  ghost?: boolean;
}) {
  if (!stone) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: ghost
            ? "color-mix(in oklch, var(--color-primary) 22%, transparent)"
            : "transparent",
          border: ghost
            ? "1.5px dashed color-mix(in oklch, var(--color-primary) 60%, transparent)"
            : "none",
        }}
      />
    );
  }
  const isWhite = stone === "white";
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: isWhite
          ? "radial-gradient(circle at 30% 30%, oklch(96% 0.01 90), oklch(82% 0.02 90) 70%, oklch(70% 0.04 80) 100%)"
          : "radial-gradient(circle at 30% 30%, oklch(35% 0.02 260), oklch(18% 0.02 260) 70%, oklch(10% 0.01 260) 100%)",
        boxShadow: highlight
          ? "0 0 0 2.5px var(--color-success), 0 6px 14px color-mix(in oklch, var(--color-success) 30%, transparent)"
          : "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -2px 4px oklch(0% 0 0 / 0.25), 0 2px 4px oklch(0% 0 0 / 0.25)",
      }}
    />
  );
}

// ------------------------- Quadrant box -------------------------

const QUADRANT_BG: Record<Quadrant, string> = {
  0: "color-mix(in oklch, var(--color-base-300) 80%, var(--color-info))",
  1: "color-mix(in oklch, var(--color-base-300) 80%, var(--color-success))",
  2: "color-mix(in oklch, var(--color-base-300) 80%, var(--color-warning))",
  3: "color-mix(in oklch, var(--color-base-300) 80%, var(--color-error))",
};

// ------------------------- Board -------------------------

function PentagoBoard_({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<PentagoView, PentagoMove>) {
  const playersById = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const p of players) map[p.id] = p;
    return map;
  }, [players]);
  const nameOf = (id: string) => playersById[id]?.name ?? id;

  const isOver = view.phase === "gameOver";
  const myStone = view.colors[me] ?? null;
  const currentName = nameOf(view.current);
  const winSet = useMemo(
    () => new Set(view.winningLine ?? []),
    [view.winningLine],
  );

  const [hover, setHover] = useState<{ row: number; col: number } | null>(null);

  const onClickCell = (row: number, col: number) => {
    if (isOver) return;
    if (!isMyTurn) return;
    if (view.phase !== "place") return;
    if (view.board[idx(row, col)] !== null) return;
    sendMove({ kind: "place", row, col });
  };

  const onRotate = (quadrant: Quadrant, direction: Rotation) => {
    if (isOver) return;
    if (!isMyTurn) return;
    if (view.phase !== "rotate") return;
    sendMove({ kind: "rotate", quadrant, direction });
  };

  const cells = view.board;

  return (
    <div className="flex flex-col items-center gap-5 w-full max-w-3xl">
      <Header
        view={view}
        playersById={playersById}
        me={me}
        isMyTurn={isMyTurn}
        myStone={myStone}
        currentName={currentName}
      />

      {/* Board */}
      <div
        className="relative rounded-2xl p-3"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 65%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -1px 0 oklch(0% 0 0 / 0.18)",
        }}
      >
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {([0, 1, 2, 3] as Quadrant[]).map((q) => (
            <QuadrantBox
              key={q}
              q={q}
              cells={cells}
              hover={hover}
              setHover={setHover}
              onClickCell={onClickCell}
              onRotate={onRotate}
              isMyTurn={isMyTurn}
              phase={view.phase}
              myStone={myStone}
              winSet={winSet}
              lastPlacement={view.lastPlacement}
            />
          ))}
        </div>
      </div>

      {/* Status */}
      {isOver ? (
        <GameOver
          view={view}
          playersById={playersById}
          me={me}
        />
      ) : (
        <PhaseBanner
          phase={view.phase}
          isMyTurn={isMyTurn}
          currentName={currentName}
        />
      )}
    </div>
  );
}

function Header({
  view,
  playersById,
  me,
  isMyTurn,
  myStone,
  currentName,
}: {
  view: PentagoView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
  isMyTurn: boolean;
  myStone: Stone | null;
  currentName: string;
}) {
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      {view.players.map((id) => {
        const stone = view.colors[id];
        const active = view.current === id && view.phase !== "gameOver";
        const isMe = id === me;
        return (
          <div
            key={id}
            className={[
              "rounded-xl px-3 py-2 flex items-center gap-2 border transition-colors",
              active
                ? "border-primary/55 bg-primary/10"
                : "border-base-300/80 bg-base-100",
            ].join(" ")}
          >
            <StoneVisual stone={stone ?? null} size={20} />
            <div className="flex flex-col">
              <span
                className={[
                  "text-sm font-semibold truncate max-w-[160px]",
                  active ? "text-primary" : "",
                ].join(" ")}
              >
                {playersById[id]?.name ?? id}
                {isMe && (
                  <span className="text-[9px] uppercase tracking-[0.18em] text-base-content/50 ml-1">
                    you
                  </span>
                )}
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-base-content/55">
                {stone}
              </span>
            </div>
          </div>
        );
      })}
      <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/50">
        Turn {view.turn}
        {!isMyTurn && view.phase !== "gameOver" && (
          <> · waiting on {currentName}</>
        )}
        {isMyTurn && myStone && (
          <> · you ({myStone})</>
        )}
      </div>
    </div>
  );
}

function QuadrantBox({
  q,
  cells,
  hover,
  setHover,
  onClickCell,
  onRotate,
  isMyTurn,
  phase,
  myStone,
  winSet,
  lastPlacement,
}: {
  q: Quadrant;
  cells: (Stone | null)[];
  hover: { row: number; col: number } | null;
  setHover: (h: { row: number; col: number } | null) => void;
  onClickCell: (row: number, col: number) => void;
  onRotate: (q: Quadrant, dir: Rotation) => void;
  isMyTurn: boolean;
  phase: PentagoView["phase"];
  myStone: Stone | null;
  winSet: Set<number>;
  lastPlacement: PentagoView["lastPlacement"];
}) {
  const qRow = q < 2 ? 0 : 3;
  const qCol = q % 2 === 0 ? 0 : 3;
  const canRotate = isMyTurn && phase === "rotate";

  return (
    <div
      className="rounded-xl p-2 relative"
      style={{
        background: QUADRANT_BG[q],
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.12)",
      }}
    >
      <div
        className="grid"
        style={{
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 4,
        }}
      >
        {Array.from({ length: 9 }).map((_, k) => {
          const r = qRow + Math.floor(k / 3);
          const c = qCol + (k % 3);
          const v = cells[idx(r, c)] ?? null;
          const isHover =
            hover && hover.row === r && hover.col === c;
          const showGhost =
            !v && phase === "place" && isMyTurn && !!myStone && !!isHover;
          const isLast =
            lastPlacement &&
            lastPlacement.row === r &&
            lastPlacement.col === c;
          const isWin = winSet.has(idx(r, c));
          return (
            <button
              key={k}
              type="button"
              onMouseEnter={() => setHover({ row: r, col: c })}
              onMouseLeave={() => setHover(null)}
              onClick={() => onClickCell(r, c)}
              disabled={
                phase !== "place" || !isMyTurn || v !== null
              }
              className="rounded-md flex items-center justify-center transition-transform"
              style={{
                aspectRatio: "1 / 1",
                background:
                  "color-mix(in oklch, var(--color-base-100) 75%, transparent)",
                boxShadow:
                  isLast || isWin
                    ? "inset 0 0 0 2px var(--color-success)"
                    : "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -1px 1px oklch(0% 0 0 / 0.08)",
                cursor:
                  phase === "place" && isMyTurn && v === null
                    ? "pointer"
                    : "default",
              }}
            >
              {showGhost ? (
                <StoneVisual
                  stone={myStone ?? null}
                  size={32}
                  ghost
                />
              ) : (
                <StoneVisual stone={v} size={32} highlight={isWin} />
              )}
            </button>
          );
        })}
      </div>

      {canRotate && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full flex gap-1 mt-2 z-10">
          <button
            type="button"
            onClick={() => onRotate(q, "ccw")}
            className="btn btn-xs btn-ghost rounded-full px-2"
            title="Rotate counter-clockwise"
            aria-label={`Rotate quadrant ${q} counter-clockwise`}
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => onRotate(q, "cw")}
            className="btn btn-xs btn-ghost rounded-full px-2"
            title="Rotate clockwise"
            aria-label={`Rotate quadrant ${q} clockwise`}
          >
            ↻
          </button>
        </div>
      )}
    </div>
  );
}

function PhaseBanner({
  phase,
  isMyTurn,
  currentName,
}: {
  phase: PentagoView["phase"];
  isMyTurn: boolean;
  currentName: string;
}) {
  if (phase === "place") {
    return (
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold pb-6">
        {isMyTurn ? (
          <span className="text-primary font-bold">Place a marble</span>
        ) : (
          <>
            Waiting on{" "}
            <span className="text-base-content font-bold">{currentName}</span> to place
          </>
        )}
      </div>
    );
  }
  return (
    <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold pb-6">
      {isMyTurn ? (
        <span className="text-primary font-bold">Twist any quadrant</span>
      ) : (
        <>
          Waiting on{" "}
          <span className="text-base-content font-bold">{currentName}</span> to twist
        </>
      )}
    </div>
  );
}

function GameOver({
  view,
  playersById,
  me,
}: {
  view: PentagoView;
  playersById: Record<string, { id: string; name: string }>;
  me: string;
}) {
  const winners = view.winners ?? [];
  const isWinner = winners.includes(me);
  let headline: string;
  if (view.draw && !winners.length) {
    headline = "Stalemate — board full, no five in a row.";
  } else if (view.draw) {
    headline = "Both colors lined up — shared draw.";
  } else if (winners.length === 1) {
    const w = winners[0]!;
    const stone = view.colors[w];
    headline = isWinner
      ? `You win — five ${stone}s in a row.`
      : `${playersById[w]?.name ?? w} wins — five ${stone}s in a row.`;
  } else {
    headline = "Game over.";
  }

  return (
    <div
      className="max-w-2xl w-full rounded-2xl p-5 flex flex-col gap-2 parlor-fade"
      style={{
        background: view.draw
          ? "color-mix(in oklch, var(--color-warning) 14%, var(--color-base-100))"
          : "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))",
        border: view.draw
          ? "1px solid color-mix(in oklch, var(--color-warning) 40%, transparent)"
          : "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold">
        {view.draw ? "◆ Draw ◆" : "◆ Five in a row ◆"}
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {headline}
      </div>
    </div>
  );
}

export const pentagoClientModule: ClientGameModule<
  PentagoView,
  PentagoMove,
  PentagoConfig
> = {
  type: PENTAGO_TYPE,
  Board: PentagoBoard_,
};

// Help unused-import linter: BOARD_SIZE imported for future use.
void BOARD_SIZE;
