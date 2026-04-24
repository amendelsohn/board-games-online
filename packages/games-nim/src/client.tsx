import { useEffect, useMemo, useRef, useState } from "react";
import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  NIM_TYPE,
  type NimMove,
  type NimView,
  type PileIndex,
} from "./shared";

const PILE_LABELS = ["I", "II", "III"] as const;

function NimBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<NimView, NimMove>) {
  const isOver = view.winner !== null;

  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const [flashPile, setFlashPile] = useState<PileIndex | null>(null);
  const lastMoveRef = useRef<NimView["lastMove"]>(view.lastMove);
  useEffect(() => {
    const prev = lastMoveRef.current;
    const now = view.lastMove;
    const changed =
      (!prev && now) ||
      (prev &&
        now &&
        (prev.by !== now.by ||
          prev.pile !== now.pile ||
          prev.count !== now.count));
    if (changed && now) {
      setFlashPile(now.pile);
      const t = setTimeout(() => setFlashPile(null), 900);
      lastMoveRef.current = now;
      return () => clearTimeout(t);
    }
    lastMoveRef.current = now;
  }, [view.lastMove]);

  const [activePile, setActivePile] = useState<PileIndex | null>(null);
  const [selectedCount, setSelectedCount] = useState<number>(0);

  useEffect(() => {
    if (activePile === null) return;
    const size = view.piles[activePile] ?? 0;
    if (size <= 0) {
      setActivePile(null);
      setSelectedCount(0);
    } else if (selectedCount > size) {
      setSelectedCount(size);
    }
  }, [view.piles, activePile, selectedCount]);

  useEffect(() => {
    if (!isMyTurn) {
      setActivePile(null);
      setSelectedCount(0);
    }
  }, [isMyTurn]);

  const pickPile = (i: PileIndex, size: number) => {
    if (!isMyTurn || isOver || size <= 0) return;
    if (activePile === i) return;
    setActivePile(i);
    setSelectedCount(1);
  };

  const hoverStone = (i: PileIndex, fromTop: number, size: number) => {
    if (!isMyTurn || isOver || size <= 0) return;
    if (activePile !== i) {
      setActivePile(i);
    }
    setSelectedCount(Math.max(1, Math.min(size, fromTop)));
  };

  const submit = () => {
    if (!isMyTurn || isOver) return;
    if (activePile === null) return;
    const size = view.piles[activePile] ?? 0;
    const count = Math.max(1, Math.min(size, selectedCount));
    if (count < 1) return;
    void sendMove({ kind: "take", pile: activePile, count });
  };

  const currentName = playersById[view.current]?.name ?? "Opponent";
  const winnerName = view.winner
    ? playersById[view.winner]?.name ?? "Someone"
    : null;

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div
        role="status"
        aria-live="polite"
        className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold"
      >
        {isOver ? (
          view.winner === me ? (
            <span>
              <span className="text-success font-bold">You win!</span>{" "}
              <span className="text-base-content/60 normal-case tracking-normal">
                (took the last stone)
              </span>
            </span>
          ) : (
            <span>
              <span className="text-base-content font-bold">{winnerName}</span>{" "}
              wins.{" "}
              <span className="text-base-content/60 normal-case tracking-normal">
                (took the last stone)
              </span>
            </span>
          )
        ) : isMyTurn ? (
          <span className="text-primary font-bold">Your turn</span>
        ) : (
          <span className="inline-flex items-center gap-1">
            Waiting on{" "}
            <span className="text-base-content font-bold">{currentName}</span>
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full bg-base-content/40 animate-pulse ml-1"
            />
          </span>
        )}
      </div>

      <div
        className="relative rounded-2xl p-4 md:p-6 w-full max-w-2xl"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 75%, color-mix(in oklch, var(--color-warning) 8%, transparent))",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-center gap-3 sm:gap-6 md:gap-8">
          {view.piles.map((size, i) => {
            const pileIdx = i as PileIndex;
            const isActive = activePile === pileIdx;
            const isFlashing = flashPile === pileIdx;
            const canPick = isMyTurn && !isOver && size > 0;
            const stonesToShow = Math.max(size, 1);

            return (
              <div
                key={i}
                className={[
                  "flex flex-col items-stretch sm:items-center",
                  "transition-transform duration-200",
                  isActive ? "sm:scale-[1.03]" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  disabled={!canPick && !isActive}
                  onClick={() => pickPile(pileIdx, size)}
                  onMouseLeave={() => {
                    if (isActive && isMyTurn && !isOver) {
                      setSelectedCount((c) => (c === 0 ? 1 : c));
                    }
                  }}
                  aria-pressed={isActive}
                  className={[
                    "relative flex items-center gap-3 sm:flex-col-reverse sm:gap-1.5",
                    "px-3 py-2 sm:pt-3 sm:pb-2 rounded-xl",
                    "min-h-[44px] w-full sm:w-auto sm:min-w-[5rem]",
                    "transition-all duration-200",
                    canPick ? "cursor-pointer" : "cursor-default",
                    isActive
                      ? "bg-primary/10 ring-[3px] ring-primary"
                      : canPick
                        ? "hover:bg-base-100/70"
                        : "",
                    isFlashing ? "parlor-win" : "",
                  ].join(" ")}
                  style={{
                    boxShadow: isActive
                      ? "0 8px 24px color-mix(in oklch, var(--color-primary) 25%, transparent)"
                      : undefined,
                  }}
                  aria-label={`Pile ${PILE_LABELS[i]}, ${size} stones${isActive ? `, taking ${selectedCount}` : ""}`}
                >
                  {isActive && (
                    <span
                      aria-hidden
                      className="absolute -top-2 left-3 sm:left-1/2 sm:-translate-x-1/2 px-2 py-0.5 rounded-full bg-primary text-primary-content text-[9px] uppercase tracking-[0.2em] font-semibold"
                    >
                      Picked
                    </span>
                  )}

                  {/* Label block — left of stones on mobile, below on desktop */}
                  <div className="flex flex-col items-center gap-0.5 min-w-[3rem] sm:order-2 sm:min-w-0">
                    <span className="text-xs font-display tracking-[0.25em] text-base-content/60">
                      {PILE_LABELS[i]}
                    </span>
                    <span className="text-[10px] text-base-content/45 font-mono tabular-nums">
                      {size} left
                    </span>
                  </div>

                  {/* Stones — row on mobile, stack on desktop */}
                  <div
                    className={[
                      "flex items-center gap-1 flex-1 sm:flex-initial sm:gap-1.5",
                      "sm:flex-col-reverse flex-wrap sm:flex-nowrap justify-start sm:justify-start",
                    ].join(" ")}
                  >
                    {size === 0 ? (
                      <span
                        className="h-5 w-5 sm:h-6 sm:w-8 rounded-full border border-dashed flex items-center justify-center text-[10px] uppercase tracking-wider"
                        style={{
                          borderColor: "color-mix(in oklch, var(--color-base-content) 15%, transparent)",
                          color: "color-mix(in oklch, var(--color-base-content) 30%, transparent)",
                        }}
                      >
                        —
                      </span>
                    ) : (
                      Array.from({ length: stonesToShow }).map((_, idxFromBottom) => {
                        const fromTop = size - idxFromBottom;
                        const willBeTaken = isActive && fromTop <= selectedCount;
                        return (
                          <span
                            key={idxFromBottom}
                            onMouseEnter={(e) => {
                              e.stopPropagation();
                              hoverStone(pileIdx, fromTop, size);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (!canPick) return;
                              if (activePile !== pileIdx) {
                                setActivePile(pileIdx);
                              }
                              setSelectedCount(Math.max(1, Math.min(size, fromTop)));
                            }}
                            className={[
                              "block h-5 w-5 sm:h-6 sm:w-8 rounded-full",
                              "transition-all duration-200",
                              willBeTaken ? "parlor-fade" : "",
                              // Let mobile taps fall through to the pile button;
                              // hover-capable pointers get the stone-level handlers.
                              "pointer-events-none sm:pointer-events-auto",
                            ].join(" ")}
                            style={{
                              background: willBeTaken
                                ? "radial-gradient(ellipse at 35% 30%, color-mix(in oklch, var(--color-primary) 40%, white 20%) 0%, color-mix(in oklch, var(--color-primary) 65%, var(--color-base-100)) 80%)"
                                : "radial-gradient(ellipse at 35% 30%, color-mix(in oklch, var(--color-base-100) 92%, white 8%) 0%, color-mix(in oklch, var(--color-base-content) 22%, var(--color-base-100)) 78%)",
                              boxShadow: willBeTaken
                                ? "0 2px 6px color-mix(in oklch, var(--color-primary) 40%, transparent), inset 0 1px 0 oklch(100% 0 0 / 0.4), inset 0 -1px 0 oklch(0% 0 0 / 0.2)"
                                : "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -1px 0 oklch(0% 0 0 / 0.2), 0 1px 2px oklch(0% 0 0 / 0.15)",
                              transform: willBeTaken ? "translateY(-2px)" : undefined,
                            }}
                          />
                        );
                      })
                    )}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Unified stepper + submit pill */}
      {!isOver && (
        <div className="flex flex-col items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-full p-1"
            style={{
              background: "var(--color-base-100)",
              boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--color-base-content) 12%, transparent), 0 1px 2px oklch(0% 0 0 / 0.08)",
            }}
          >
            <button
              type="button"
              disabled={!isMyTurn || activePile === null || selectedCount <= 1}
              onClick={() => setSelectedCount((c) => Math.max(1, c - 1))}
              className="h-9 w-9 rounded-full text-lg font-bold text-base-content/80 hover:bg-base-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="decrease"
            >
              −
            </button>
            <div className="px-3 min-w-[7rem] text-center">
              <div className="text-[9px] uppercase tracking-[0.22em] text-base-content/50">
                Take
              </div>
              <div className="font-mono tabular-nums text-sm text-base-content leading-tight">
                {activePile === null
                  ? "pick a pile"
                  : `${selectedCount} from ${PILE_LABELS[activePile]}`}
              </div>
            </div>
            <button
              type="button"
              disabled={
                !isMyTurn ||
                activePile === null ||
                selectedCount >= (view.piles[activePile ?? 0] ?? 0)
              }
              onClick={() => {
                if (activePile === null) return;
                const size = view.piles[activePile] ?? 0;
                setSelectedCount((c) => Math.min(size, c + 1));
              }}
              className="h-9 w-9 rounded-full text-lg font-bold text-base-content/80 hover:bg-base-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="increase"
            >
              +
            </button>
            <button
              type="button"
              disabled={!isMyTurn || activePile === null || selectedCount < 1}
              onClick={submit}
              className={[
                "h-9 px-4 rounded-full font-display tracking-wide tabular-nums ml-1",
                "transition-all duration-200",
                isMyTurn && activePile !== null
                  ? "bg-primary text-primary-content hover:brightness-110 cursor-pointer shadow-[0_4px_12px_color-mix(in_oklch,var(--color-primary)_35%,transparent)]"
                  : "bg-base-200 text-base-content/40 cursor-not-allowed",
              ].join(" ")}
            >
              {!isMyTurn
                ? "Wait"
                : activePile === null
                  ? "Pick"
                  : `Take ${selectedCount}`}
            </button>
          </div>
          <div className="text-xs text-base-content/50 tracking-wide text-center max-w-sm px-4">
            Take ≥1 stone from one pile. The player who takes the last stone
            wins.
          </div>
        </div>
      )}

      {view.lastMove && (
        <div className="text-[11px] text-base-content/50 tracking-wide font-mono tabular-nums">
          Last: {playersById[view.lastMove.by]?.name ?? "Someone"} took{" "}
          {view.lastMove.count} from {PILE_LABELS[view.lastMove.pile]}
        </div>
      )}
    </div>
  );
}

export const nimClientModule: ClientGameModule<
  NimView,
  NimMove,
  Record<string, never>
> = {
  type: NIM_TYPE,
  Board: NimBoard,
};
