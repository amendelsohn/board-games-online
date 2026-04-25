import {
  Card as CardShell,
  PlayerUILayout,
  type BoardProps,
  type ClientGameModule,
} from "@bgo/sdk-client";
import {
  GRID_COLS,
  MEMORY_TYPE,
  type MemoryMove,
  type MemoryView,
} from "./shared";

/**
 * Face-up content for a memory cell. The big symbol sits centered on a tinted
 * background; when claimed by a player the background gets that player's color
 * wash + a faint owner badge in the corner.
 */
function MemoryFace({
  symbol,
  ownerColor,
  ownerInitial,
}: {
  symbol: string | null;
  ownerColor: string | null;
  ownerInitial: string | null;
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
          fontVariationSettings: "'wght' 700",
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

  const scoreboard = (
    <div className="flex flex-wrap items-center justify-center gap-3">
      {view.players.map((pid) => {
        const color = colorForPlayer(view.players, pid);
        const isCurrent = pid === view.current && !isOver;
        const isWinner = isOver && view.winner === pid;
        return (
          <div
            key={pid}
            className={[
              "flex items-center gap-2 px-4 py-2 rounded-xl",
              "transition-all",
              isCurrent ? "" : isOver && !isWinner ? "opacity-60" : "",
              isWinner ? "parlor-win" : "",
            ].join(" ")}
            style={{
              background: `color-mix(in oklch, ${color} 14%, transparent)`,
              boxShadow: isCurrent
                ? `inset 0 0 0 2px ${color}`
                : isWinner
                  ? `inset 0 0 0 2px ${color}, 0 8px 22px color-mix(in oklch, ${color} 35%, transparent)`
                  : undefined,
            }}
          >
            <span
              className="text-2xl font-display font-bold leading-none"
              style={{ color }}
            >
              {view.scores[pid] ?? 0}
            </span>
            <div className="flex flex-col">
              <span
                className="text-[10px] uppercase tracking-[0.22em] font-semibold leading-tight"
                style={{ color }}
              >
                {pid === me ? "You" : nameOf(pid)}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-base-content/55 leading-tight">
                pairs
                {isCurrent ? " · turn" : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const turnBanner = turnLabel && (
    <div
      className={[
        "text-xs uppercase tracking-[0.22em] font-semibold text-center",
        inPeek ? "text-warning" : "text-base-content/60",
      ].join(" ")}
    >
      {turnLabel}
    </div>
  );

  const board = (
    <div
      className="relative rounded-2xl p-3 md:p-4 mx-auto"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 85%, transparent)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
        width: "min(95%, 720px)",
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
            ? (nameOf(card.owner!).slice(0, 1).toUpperCase() || null)
            : null;

          const disabled =
            isOver ||
            inPeek ||
            !isMyTurn ||
            claimed ||
            revealed ||
            view.revealed.length >= 2;

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
              }}
            >
              {faceUp && (
                <MemoryFace
                  symbol={card.symbol}
                  ownerColor={ownerColor}
                  ownerInitial={ownerInitial}
                />
              )}
            </CardShell>
          );
        })}
      </div>
    </div>
  );

  const toolbar =
    inPeek && currentIsMe ? (
      <div className="flex justify-center">
        <button
          type="button"
          onClick={dismissPeek}
          className="px-4 py-1.5 rounded-full text-xs uppercase tracking-[0.2em] font-semibold transition-colors"
          style={{
            background:
              "color-mix(in oklch, var(--color-warning) 22%, transparent)",
            color: "var(--color-warning)",
            boxShadow: "inset 0 0 0 1px var(--color-warning)",
          }}
        >
          Continue
        </button>
      </div>
    ) : banner ? (
      <div className="flex justify-center">
        <div
          className="px-5 py-2 rounded-xl font-display font-bold text-lg parlor-win"
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
      </div>
    ) : undefined;

  return (
    <PlayerUILayout
      topStrip={
        <div className="flex flex-col gap-3 items-center">
          {scoreboard}
          {turnBanner}
        </div>
      }
      main={board}
      bottomStrip={toolbar}
      containerMaxWidth={1200}
    />
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
