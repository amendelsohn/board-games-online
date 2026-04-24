import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card as CardShell,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  GRID_COLS,
  MEMORY_TYPE,
  type MemoryMove,
  type MemoryView,
} from "./shared";

const PEEK_AUTO_MS = 1800;

function MemoryFace({
  symbol,
  ownerColor,
  ownerInitial,
  claimed,
}: {
  symbol: string | null;
  ownerColor: string | null;
  ownerInitial: string | null;
  claimed: boolean;
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center parlor-fade"
      style={{
        background: ownerColor
          ? `color-mix(in oklch, ${ownerColor} 18%, var(--color-base-100))`
          : "var(--color-base-100)",
      }}
    >
      <span
        className="font-display leading-none text-3xl md:text-4xl"
        style={{
          color: ownerColor ?? "var(--color-base-content)",
          fontWeight: 700,
          textShadow: ownerColor
            ? `0 1px 0 color-mix(in oklch, ${ownerColor} 30%, transparent)`
            : undefined,
        }}
      >
        {symbol}
      </span>
      {ownerColor && ownerInitial && (
        <span
          aria-hidden
          className="absolute top-1 right-1.5 text-[8px] font-bold uppercase tracking-wider"
          style={{ color: ownerColor, opacity: 0.7 }}
        >
          {ownerInitial}
        </span>
      )}
      {claimed && ownerColor && (
        <span
          aria-hidden
          className="absolute bottom-1 left-1.5 text-[10px] font-bold leading-none"
          style={{ color: ownerColor, opacity: 0.7 }}
        >
          ✓
        </span>
      )}
    </div>
  );
}

/**
 * Four player slots → four distinct theme colors. Assigned in join order
 * so a given player always has the same color for the whole match.
 */
const PLAYER_SLOT_COLORS: readonly string[] = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
  "var(--color-info)",
];

function colorForPlayer(
  players: readonly string[],
  pid: string | null | undefined,
): string {
  if (!pid) return "var(--color-base-content)";
  const idx = players.indexOf(pid);
  if (idx < 0) return "var(--color-base-content)";
  return PLAYER_SLOT_COLORS[idx % PLAYER_SLOT_COLORS.length]!;
}

function initialsForName(name: string): string | null {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return parts
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || null;
}

function MemoryBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<MemoryView, MemoryMove>) {
  const isOver = view.phase === "gameOver";
  const inPeek = view.phase === "peek";

  const nameOf = (id: string) =>
    players.find((p) => p.id === id)?.name ?? "Player";

  const handleFlip = (i: number) => {
    if (isOver || inPeek || !isMyTurn) return;
    const card = view.cards[i];
    if (!card) return;
    if (card.owner !== null) return;
    if (view.revealed.includes(i)) return;
    if (view.revealed.length >= 2) return;
    void sendMove({ kind: "flip", cellIndex: i });
  };

  const dismissPeek = () => {
    if (!inPeek || !isMyTurn) return;
    void sendMove({ kind: "clearPeek" });
  };

  const currentIsMe = view.current === me;

  // Auto-continue after peek: when the peek phase starts for the current
  // player, schedule a clearPeek after 1.8s. Continue button still works as
  // a manual override.
  useEffect(() => {
    if (!inPeek || !currentIsMe) return;
    const t = setTimeout(() => {
      void sendMove({ kind: "clearPeek" });
    }, PEEK_AUTO_MS);
    return () => clearTimeout(t);
    // sendMove is a stable prop; we only want to restart the timer on phase
    // transitions, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPeek, currentIsMe]);

  // Match-celebration beat: when cards transition from unowned → owned in the
  // same tick, pop those cards and pulse the scoring player's scoreboard.
  const prevOwnersRef = useRef<(string | null)[]>(view.cards.map((c) => c.owner));
  const [celebratingIdx, setCelebratingIdx] = useState<number[]>([]);
  const [pulsingScore, setPulsingScore] = useState<string | null>(null);
  useEffect(() => {
    const prev = prevOwnersRef.current;
    const newlyClaimed: number[] = [];
    let scorer: string | null = null;
    view.cards.forEach((c, i) => {
      const prevOwner = prev[i] ?? null;
      if (prevOwner === null && c.owner !== null) {
        newlyClaimed.push(i);
        scorer = c.owner;
      }
    });
    prevOwnersRef.current = view.cards.map((c) => c.owner);
    if (newlyClaimed.length > 0) {
      setCelebratingIdx(newlyClaimed);
      setPulsingScore(scorer);
      const t1 = setTimeout(() => setCelebratingIdx([]), 500);
      const t2 = setTimeout(() => setPulsingScore(null), 600);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [view.cards]);

  const turnLabel = isOver
    ? null
    : inPeek
      ? currentIsMe
        ? "No match — continuing…"
        : `${nameOf(view.current)} is peeking…`
      : currentIsMe
        ? view.revealed.length === 0
          ? "Your turn — flip a card"
          : "Flip a second card"
        : `${nameOf(view.current)}'s turn`;

  let banner: { text: string; tone: "win" | "lose" | "draw" } | null = null;
  if (isOver) {
    if (view.isDraw) banner = { text: "It's a draw — everyone tied.", tone: "draw" };
    else if (view.winner === me) banner = { text: "You win!", tone: "win" };
    else if (view.winner)
      banner = { text: `${nameOf(view.winner)} wins.`, tone: "lose" };
  }

  const totalPairs = view.cards.length / 2;
  const foundPairs = useMemo(
    () => Object.values(view.scores).reduce((a, b) => a + b, 0),
    [view.scores],
  );

  return (
    <div className="flex flex-col items-center gap-5">
      <style>{`
        @keyframes memory-peek-drain {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes memory-match-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.10); }
          70%  { transform: scale(0.98); }
          100% { transform: scale(1); }
        }
        @keyframes memory-score-pop {
          0%   { transform: scale(1); }
          50%  { transform: scale(1.25); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* Scoreboard + pairs counter */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {view.players.map((pid) => {
            const color = colorForPlayer(view.players, pid);
            const isCurrent = pid === view.current && !isOver;
            const isWinner = isOver && view.winner === pid;
            const isPulsing = pulsingScore === pid;
            return (
              <div
                key={pid}
                className={[
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl",
                  "transition-all",
                  isCurrent
                    ? "ring-2 ring-offset-2 ring-offset-base-100"
                    : isOver && !isWinner
                      ? "opacity-60"
                      : "",
                  isWinner ? "parlor-win" : "",
                ].join(" ")}
                style={{
                  background: `color-mix(in oklch, ${color} 14%, transparent)`,
                  boxShadow: isCurrent
                    ? `0 0 0 2px ${color}`
                    : isWinner
                      ? `0 0 0 2px ${color}, 0 8px 22px color-mix(in oklch, ${color} 35%, transparent)`
                      : undefined,
                }}
              >
                <span
                  className="text-[10px] uppercase tracking-[0.22em] font-semibold"
                  style={{ color }}
                >
                  {pid === me ? "You" : nameOf(pid)}
                </span>
                <span
                  className="text-xl sm:text-2xl font-display font-bold leading-none tabular-nums"
                  style={{
                    color,
                    display: "inline-block",
                    animation: isPulsing
                      ? "memory-score-pop 500ms ease-out"
                      : undefined,
                  }}
                >
                  {view.scores[pid] ?? 0}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-base-content/55">
                  pairs
                </span>
              </div>
            );
          })}
        </div>
        <span className="font-mono text-[10px] tabular-nums uppercase tracking-[0.22em] text-base-content/55">
          <span className="text-base-content/85 font-semibold">{foundPairs}</span>
          <span className="text-base-content/40"> / </span>
          {totalPairs} pairs
        </span>
      </div>

      {/* Board */}
      <div
        className="relative rounded-2xl p-3 md:p-4"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 75%, color-mix(in oklch, var(--color-warning) 8%, transparent))",
          boxShadow: `${
            !currentIsMe && inPeek
              ? "0 0 0 2px color-mix(in oklch, var(--color-warning) 30%, transparent), "
              : ""
          }inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)`,
          width: "min(92vw, 540px)",
        }}
      >
        <div
          className="grid gap-2"
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          }}
        >
          {view.cards.map((card, i) => {
            const claimed = card.owner !== null;
            const revealed = view.revealed.includes(i);
            const faceUp = claimed || revealed;
            const ownerColor = claimed
              ? colorForPlayer(view.players, card.owner)
              : null;
            const ownerInitial = claimed
              ? initialsForName(nameOf(card.owner!))
              : null;

            const disabled =
              isOver ||
              inPeek ||
              !isMyTurn ||
              claimed ||
              revealed ||
              view.revealed.length >= 2;

            const isCelebrating = celebratingIdx.includes(i);

            return (
              <CardShell
                key={i}
                size="md"
                faceDown={!faceUp}
                disabled={disabled}
                onClick={disabled ? undefined : () => handleFlip(i)}
                ariaLabel={
                  faceUp
                    ? `card ${i} showing ${card.symbol}${claimed ? ` owned by ${nameOf(card.owner!)}` : ""}`
                    : `face-down card ${i}`
                }
                className="parlor-rise"
                style={{
                  width: "100%",
                  height: "auto",
                  aspectRatio: "1 / 1",
                  borderRadius: 12,
                  animation: isCelebrating
                    ? "memory-match-pop 500ms ease-out"
                    : undefined,
                }}
              >
                {faceUp && (
                  <MemoryFace
                    symbol={card.symbol}
                    ownerColor={ownerColor}
                    ownerInitial={ownerInitial}
                    claimed={claimed}
                  />
                )}
              </CardShell>
            );
          })}
        </div>
      </div>

      {/* Turn / phase indicator */}
      {turnLabel && (
        <div
          role="status"
          aria-live="polite"
          className={[
            "text-xs uppercase tracking-[0.22em] font-semibold",
            inPeek ? "text-warning" : "text-base-content/60",
          ].join(" ")}
        >
          {turnLabel}
        </div>
      )}

      {inPeek && currentIsMe && (
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={dismissPeek}
            className="px-4 py-1.5 rounded-full text-xs uppercase tracking-[0.2em] font-semibold transition-colors"
            style={{
              background: "color-mix(in oklch, var(--color-warning) 22%, transparent)",
              color: "var(--color-warning)",
              boxShadow: "inset 0 0 0 1px var(--color-warning)",
            }}
          >
            Continue now
          </button>
          <div
            className="h-1 w-24 rounded-full overflow-hidden"
            style={{
              background: "color-mix(in oklch, var(--color-warning) 20%, transparent)",
            }}
            aria-hidden
          >
            <div
              style={{
                height: "100%",
                background: "var(--color-warning)",
                animation: `memory-peek-drain ${PEEK_AUTO_MS}ms linear forwards`,
              }}
            />
          </div>
        </div>
      )}

      {banner && (
        <div
          className={[
            "mt-1 px-5 py-2 rounded-xl font-display font-bold text-lg parlor-win",
          ].join(" ")}
          style={{
            background:
              banner.tone === "win"
                ? "color-mix(in oklch, var(--color-success) 22%, transparent)"
                : banner.tone === "lose"
                  ? "color-mix(in oklch, var(--color-base-content) 8%, var(--color-base-100))"
                  : "color-mix(in oklch, var(--color-warning) 20%, transparent)",
            color:
              banner.tone === "win"
                ? "var(--color-success)"
                : banner.tone === "lose"
                  ? "var(--color-base-content)"
                  : "var(--color-warning)",
            boxShadow:
              banner.tone === "win"
                ? "0 0 0 2px var(--color-success), 0 10px 28px color-mix(in oklch, var(--color-success) 25%, transparent)"
                : banner.tone === "lose"
                  ? "inset 0 0 0 1px color-mix(in oklch, var(--color-base-content) 18%, transparent)"
                  : undefined,
          }}
        >
          {banner.text}
        </div>
      )}
    </div>
  );
}

export const memoryClientModule: ClientGameModule<
  MemoryView,
  MemoryMove,
  Record<string, never>
> = {
  type: MEMORY_TYPE,
  Board: MemoryBoard,
};
