import type { BoardProps, ClientGameModule } from "@bgo/sdk-client";
import {
  GRID_COLS,
  MEMORY_TYPE,
  type MemoryMove,
  type MemoryView,
} from "./shared";

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
  const turnLabel = isOver
    ? null
    : inPeek
      ? currentIsMe
        ? "No match — tap to continue"
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

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Scoreboard */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {view.players.map((pid) => {
          const color = colorForPlayer(view.players, pid);
          const isCurrent = pid === view.current && !isOver;
          const isWinner = isOver && view.winner === pid;
          return (
            <div
              key={pid}
              className={[
                "flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl",
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
                className="text-2xl font-display font-bold leading-none"
                style={{ color }}
              >
                {view.scores[pid] ?? 0}
              </span>
              <span
                className="text-[9px] uppercase tracking-wider text-base-content/55"
              >
                pairs
              </span>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div
        className="relative rounded-2xl p-3 md:p-4"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
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

            const disabled =
              isOver ||
              inPeek ||
              !isMyTurn ||
              claimed ||
              revealed ||
              view.revealed.length >= 2;

            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => handleFlip(i)}
                className={[
                  "relative aspect-square rounded-xl",
                  "transition-all duration-200",
                  !disabled
                    ? "hover:scale-[1.04] cursor-pointer"
                    : "cursor-default",
                  "parlor-rise",
                ].join(" ")}
                style={{
                  background: claimed
                    ? `color-mix(in oklch, ${ownerColor} 22%, var(--color-base-100))`
                    : faceUp
                      ? "var(--color-base-100)"
                      : "color-mix(in oklch, var(--color-neutral) 55%, var(--color-base-300))",
                  boxShadow: claimed
                    ? `inset 0 0 0 2px ${ownerColor}, inset 0 1px 0 oklch(100% 0 0 / 0.12)`
                    : faceUp
                      ? "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.08)"
                      : "inset 0 1px 0 oklch(100% 0 0 / 0.08), inset 0 -1px 0 oklch(0% 0 0 / 0.25)",
                }}
                aria-label={
                  faceUp
                    ? `card ${i} showing ${card.symbol}${claimed ? ` owned by ${nameOf(card.owner!)}` : ""}`
                    : `face-down card ${i}`
                }
              >
                {faceUp ? (
                  <span
                    className={[
                      "absolute inset-0 flex items-center justify-center",
                      "font-display leading-none parlor-fade",
                      "text-3xl md:text-4xl",
                    ].join(" ")}
                    style={{
                      color: claimed
                        ? ownerColor!
                        : "var(--color-base-content)",
                      fontVariationSettings: "'wght' 700",
                    }}
                  >
                    {card.symbol}
                  </span>
                ) : (
                  // Tactile patterned back — diagonal weave with a centered dot.
                  <span
                    aria-hidden
                    className="absolute inset-1 rounded-lg overflow-hidden"
                    style={{
                      background:
                        "repeating-linear-gradient(45deg, color-mix(in oklch, var(--color-primary) 28%, transparent) 0 4px, color-mix(in oklch, var(--color-secondary) 20%, transparent) 4px 8px)",
                      boxShadow:
                        "inset 0 0 0 1px color-mix(in oklch, oklch(0% 0 0) 30%, transparent)",
                    }}
                  >
                    <span
                      className="absolute inset-0 flex items-center justify-center"
                      style={{
                        color: "color-mix(in oklch, oklch(100% 0 0) 55%, transparent)",
                        fontSize: "1.3rem",
                        textShadow: "0 1px 2px oklch(0% 0 0 / 0.35)",
                      }}
                    >
                      ◆
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Turn / phase indicator */}
      {turnLabel && (
        <div
          className={[
            "text-xs uppercase tracking-[0.22em] font-semibold",
            inPeek ? "text-warning" : "text-base-content/60",
          ].join(" ")}
        >
          {turnLabel}
        </div>
      )}

      {inPeek && currentIsMe && (
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
          Continue
        </button>
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
                  ? "color-mix(in oklch, var(--color-base-300) 90%, transparent)"
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
