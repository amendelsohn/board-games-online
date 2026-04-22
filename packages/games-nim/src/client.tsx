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

  // Track the most recently affected pile so we can flash it briefly.
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

  // Selected pile + count for the submit stepper path.
  const [activePile, setActivePile] = useState<PileIndex | null>(null);
  const [selectedCount, setSelectedCount] = useState<number>(0);

  // If the selected pile empties (opponent drained it, or game resets), clear.
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

  // After our move lands, clear the selection.
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

  // Click on stone k within pile i => preview taking (size - k) stones.
  // Stones are rendered bottom-up; clicking stone at position `fromTop`
  // selects that many from the top.
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

  const currentName =
    playersById[view.current]?.name ?? "Opponent";
  const winnerName = view.winner
    ? (playersById[view.winner]?.name ?? "Someone")
    : null;
  const iAmCurrent = view.current === me;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-xs uppercase tracking-[0.22em] text-base-content/55 font-semibold">
        {isOver ? (
          <span>
            {view.winner === me ? (
              <span className="text-success font-bold">You took the last stone</span>
            ) : (
              <span>
                <span className="text-base-content font-bold">{winnerName}</span>{" "}
                took the last stone
              </span>
            )}
          </span>
        ) : isMyTurn ? (
          <span className="text-primary font-bold">Your turn</span>
        ) : (
          <span>
            Waiting on{" "}
            <span className="text-base-content font-bold">{currentName}</span>
          </span>
        )}
      </div>

      <div
        className="relative rounded-2xl p-5 md:p-7"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
        }}
      >
        <div className="flex items-end justify-center gap-6 md:gap-10">
          {view.piles.map((size, i) => {
            const pileIdx = i as PileIndex;
            const isActive = activePile === pileIdx;
            const isFlashing = flashPile === pileIdx;
            const canPick = isMyTurn && !isOver && size > 0;
            const stonesToShow = Math.max(size, 1); // reserve one slot for empty base

            // When active, show which stones are "about to be taken"
            // (the top `selectedCount` of the pile).
            return (
              <div
                key={i}
                className={[
                  "flex flex-col items-center gap-3",
                  "transition-transform duration-200",
                  isActive ? "scale-[1.03]" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  disabled={!canPick && !isActive}
                  onClick={() => pickPile(pileIdx, size)}
                  onMouseLeave={() => {
                    // Reset preview back to a single stone when leaving the pile.
                    if (isActive && isMyTurn && !isOver) {
                      setSelectedCount((c) => (c === 0 ? 1 : c));
                    }
                  }}
                  className={[
                    "relative flex flex-col-reverse items-center gap-1.5",
                    "px-3 pt-3 pb-2 rounded-xl min-w-[4.5rem]",
                    "transition-all duration-200",
                    canPick ? "cursor-pointer" : "cursor-default",
                    isActive
                      ? "bg-primary/10 ring-2 ring-primary"
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
                  aria-label={`Pile ${PILE_LABELS[i]}, ${size} stones`}
                >
                  {/* Stack of stones, rendered from the bottom up thanks to flex-col-reverse. */}
                  {size === 0 ? (
                    <span className="h-6 w-10 rounded-full border border-dashed border-base-content/25 flex items-center justify-center text-[10px] uppercase tracking-wider text-base-content/40">
                      empty
                    </span>
                  ) : (
                    Array.from({ length: stonesToShow }).map((_, idxFromBottom) => {
                      // position from top: 1 = topmost stone, size = bottom stone
                      const fromTop = size - idxFromBottom;
                      const willBeTaken =
                        isActive && fromTop <= selectedCount;
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
                            "block h-6 w-10 rounded-full",
                            "transition-all duration-200",
                            willBeTaken ? "parlor-fade" : "",
                          ].join(" ")}
                          style={{
                            background: willBeTaken
                              ? "color-mix(in oklch, var(--color-primary) 55%, var(--color-base-100))"
                              : "color-mix(in oklch, var(--color-base-content) 18%, var(--color-base-100))",
                            boxShadow: willBeTaken
                              ? "0 2px 6px color-mix(in oklch, var(--color-primary) 40%, transparent), inset 0 1px 0 oklch(100% 0 0 / 0.4), inset 0 -1px 0 oklch(0% 0 0 / 0.2)"
                              : "inset 0 1px 0 oklch(100% 0 0 / 0.3), inset 0 -1px 0 oklch(0% 0 0 / 0.2), 0 1px 2px oklch(0% 0 0 / 0.15)",
                            transform: willBeTaken
                              ? "translateY(-2px)"
                              : undefined,
                          }}
                        />
                      );
                    })
                  )}
                </button>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-display tracking-[0.25em] text-base-content/60">
                    {PILE_LABELS[i]}
                  </span>
                  <span className="text-xs text-base-content/45 tabular-nums">
                    {size} left
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stepper + submit */}
      {!isOver && (
        <div className="flex flex-col items-center gap-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={
                !isMyTurn || activePile === null || selectedCount <= 1
              }
              onClick={() =>
                setSelectedCount((c) => Math.max(1, c - 1))
              }
              className="h-9 w-9 rounded-full bg-base-100 text-lg font-bold text-base-content/80 ring-1 ring-base-300 hover:bg-base-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="decrease"
            >
              −
            </button>
            <div className="min-w-[9rem] text-center">
              <div className="text-[10px] uppercase tracking-[0.22em] text-base-content/50">
                Take
              </div>
              <div className="font-display text-2xl leading-tight text-base-content">
                {activePile === null
                  ? "—"
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
              className="h-9 w-9 rounded-full bg-base-100 text-lg font-bold text-base-content/80 ring-1 ring-base-300 hover:bg-base-200 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              aria-label="increase"
            >
              +
            </button>
          </div>
          <button
            type="button"
            disabled={!isMyTurn || activePile === null || selectedCount < 1}
            onClick={submit}
            className={[
              "mt-1 px-5 h-10 rounded-full font-display tracking-wide",
              "transition-all duration-200",
              isMyTurn && activePile !== null
                ? "bg-primary text-primary-content hover:brightness-110 cursor-pointer shadow-[0_6px_16px_color-mix(in_oklch,var(--color-primary)_35%,transparent)]"
                : "bg-base-100 text-base-content/40 cursor-not-allowed",
            ].join(" ")}
          >
            {isMyTurn
              ? activePile === null
                ? "Pick a pile"
                : `Take ${selectedCount}`
              : iAmCurrent
                ? "Submit"
                : "Not your turn"}
          </button>
          <div className="text-xs text-base-content/45 tracking-wide">
            Click a pile, then click a stone to set how many you take.
          </div>
        </div>
      )}

      {isOver && view.lastMove && (
        <div className="text-xs text-base-content/55 tracking-wide">
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
