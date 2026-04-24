import { useMemo, useState } from "react";
import {
  Card as CardShell,
  PlayingCard as PlayingCardFace,
  type Rank as DeckRank,
  type Suit as DeckSuit,
  type BoardProps,
  type CardSize,
  type ClientGameModule,
  type SummaryProps,
} from "@bgo/sdk-client";
import type { PlayerId } from "@bgo/sdk";
import {
  GO_FISH_TYPE,
  cardId,
  type AskLogEntry,
  type Card,
  type GoFishConfig,
  type GoFishMove,
  type GoFishView,
  type Rank,
} from "./shared";

type PlayerMap = Record<string, { id: string; name: string }>;

function rankToDeckRank(r: Rank): DeckRank {
  switch (r) {
    case "A":
      return 1;
    case "J":
      return 11;
    case "Q":
      return 12;
    case "K":
      return 13;
    default:
      return Number(r) as DeckRank;
  }
}

/** Plural label for a rank ("sevens", "Aces", "Kings"). */
function rankPlural(r: Rank): string {
  if (r === "A") return "Aces";
  if (r === "J") return "Jacks";
  if (r === "Q") return "Queens";
  if (r === "K") return "Kings";
  if (r === "6") return "sixes";
  return `${r}s`;
}

// ------------------------- Small visual primitives -------------------------

function HandCard({
  card,
  size = "md",
  selected,
  onClick,
}: {
  card: Card;
  size?: CardSize;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <CardShell
      size={size}
      selected={selected}
      onClick={onClick}
      ariaLabel={`${card.rank} of ${card.suit}`}
    >
      <PlayingCardFace
        suit={card.suit as DeckSuit}
        rank={rankToDeckRank(card.rank)}
      />
    </CardShell>
  );
}

function CardBack({ size = "sm" }: { size?: CardSize }) {
  return <CardShell size={size} faceDown ariaLabel="opponent card, face down" />;
}

function BookBadge({ rank }: { rank: Rank }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[10px] font-semibold tabular"
      style={{
        background:
          "color-mix(in oklch, var(--color-success) 22%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-success) 45%, transparent)",
        color:
          "color-mix(in oklch, var(--color-success) 80%, var(--color-base-content))",
        letterSpacing: "0.02em",
      }}
    >
      {rank}
    </span>
  );
}

// ------------------------- Board -------------------------

function GoFishBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<GoFishView, GoFishMove>) {
  const playersById: PlayerMap = useMemo(() => {
    const m: PlayerMap = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const [selectedTarget, setSelectedTarget] = useState<PlayerId | null>(null);
  const [selectedRank, setSelectedRank] = useState<Rank | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const myState = view.perPlayer[me];
  const myHand: Card[] = myState?.hand ?? [];
  const isOver = view.phase === "gameOver";

  // Ranks the viewer actually holds — the only valid things you're allowed to ask for.
  const availableRanks: Rank[] = useMemo(() => {
    const set = new Set<Rank>();
    for (const c of myHand) set.add(c.rank);
    // Preserve order per RANKS list for stable UI.
    const order: Rank[] = [
      "A",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
      "J",
      "Q",
      "K",
    ];
    return order.filter((r) => set.has(r));
  }, [myHand]);

  // Opponents in turn order, excluding yourself.
  const otherPlayers = view.players.filter((id) => id !== me);

  // Drop a stale target if they've emptied their hand since you picked them.
  // (They still exist; asking them would just force a "Go fish.")
  const canSubmit =
    isMyTurn &&
    !isOver &&
    selectedTarget !== null &&
    selectedRank !== null &&
    !submitting;

  const sortedHand = useMemo(() => sortHand(myHand), [myHand]);

  const askNow = async () => {
    if (!canSubmit || !selectedTarget || !selectedRank) return;
    setSubmitting(true);
    try {
      await sendMove({
        kind: "ask",
        targetPlayer: selectedTarget,
        rank: selectedRank,
      });
      setSelectedTarget(null);
      setSelectedRank(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-4xl mx-auto">
      <TopRibbon view={view} playersById={playersById} me={me} />

      {view.lastAction && (
        <LastActionLine
          entry={view.lastAction}
          playersById={playersById}
          me={me}
        />
      )}

      <OpponentsRow
        view={view}
        me={me}
        playersById={playersById}
        selectable={isMyTurn && !isOver}
        selectedTarget={selectedTarget}
        onPickTarget={setSelectedTarget}
      />

      {isOver ? (
        <GameOverPanel view={view} playersById={playersById} me={me} />
      ) : (
        <YourSeat
          hand={sortedHand}
          books={myState?.books ?? []}
          isMyTurn={isMyTurn}
          availableRanks={availableRanks}
          selectedRank={selectedRank}
          onPickRank={setSelectedRank}
          onAsk={askNow}
          canSubmit={canSubmit}
          hasTarget={!!selectedTarget}
          submitting={submitting}
        />
      )}
    </div>
  );
}

// ------------------------- Sub-components -------------------------

function TopRibbon({
  view,
  playersById,
  me,
}: {
  view: GoFishView;
  playersById: PlayerMap;
  me: PlayerId;
}) {
  if (view.phase === "gameOver") {
    const winners = view.winners ?? [];
    const youWin = winners.includes(me);
    return (
      <div
        className="rounded-2xl px-5 py-3 text-center"
        style={{
          background:
            "color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100))",
          border:
            "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
          ◆ The pond is empty ◆
        </div>
        <div
          className="font-display tracking-tight text-primary mt-0.5"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          {winners.length === 0
            ? "No winner"
            : winners.length === 1
              ? youWin
                ? "You win."
                : `${playersById[winners[0]!]?.name ?? winners[0]} wins.`
              : "It's a tie."}
        </div>
      </div>
    );
  }
  const currentName = playersById[view.current]?.name ?? view.current;
  const isMine = view.current === me;
  return (
    <div
      className="rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 55%, var(--color-base-100))",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Current turn
      </div>
      <div
        className={[
          "font-display tracking-tight",
          isMine ? "text-primary" : "text-base-content",
        ].join(" ")}
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {isMine ? "Your move" : currentName}
      </div>
      <div className="ml-auto flex items-center gap-3 text-xs text-base-content/65 tabular">
        <div>
          Pond <span className="font-semibold">{view.deckCount}</span>
        </div>
      </div>
    </div>
  );
}

function LastActionLine({
  entry,
  playersById,
  me,
}: {
  entry: AskLogEntry;
  playersById: PlayerMap;
  me: PlayerId;
}) {
  const askerName = entry.asker === me
    ? "You"
    : playersById[entry.asker]?.name ?? entry.asker;
  const targetName = entry.target === me
    ? "you"
    : playersById[entry.target]?.name ?? entry.target;
  const rank = rankPlural(entry.rank);

  let outcomeText: string;
  if (entry.gotCount > 0) {
    outcomeText = `got ${entry.gotCount} ${rank}`;
  } else if (entry.drew?.matched) {
    outcomeText = `went fishing and hooked a ${entry.rank}`;
  } else if (entry.drew) {
    outcomeText = "went fishing";
  } else {
    outcomeText = "went fishing (pond empty)";
  }

  return (
    <div
      className="rounded-xl px-4 py-2.5 text-sm flex flex-wrap items-center gap-x-2 gap-y-1"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-200) 80%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-base-content) 8%, transparent)",
      }}
    >
      <span>
        <strong className="font-semibold">{askerName}</strong> asked{" "}
        <strong className="font-semibold">{targetName}</strong> for{" "}
        <span style={{ color: "var(--color-primary)" }} className="font-semibold">
          {rank}
        </span>{" "}
        — {outcomeText}.
      </span>
      {entry.booksClaimed.length > 0 && (
        <span className="text-success font-semibold flex items-center gap-1">
          Book
          {entry.booksClaimed.length > 1 ? "s" : ""}:
          {entry.booksClaimed.map((r) => (
            <BookBadge key={r} rank={r} />
          ))}
        </span>
      )}
    </div>
  );
}

function OpponentsRow({
  view,
  me,
  playersById,
  selectable,
  selectedTarget,
  onPickTarget,
}: {
  view: GoFishView;
  me: PlayerId;
  playersById: PlayerMap;
  selectable: boolean;
  selectedTarget: PlayerId | null;
  onPickTarget: (id: PlayerId | null) => void;
}) {
  const others = view.players.filter((id) => id !== me);
  return (
    <div className="flex gap-2 md:gap-3 flex-wrap">
      {others.map((id) => {
        const pv = view.perPlayer[id]!;
        const name = playersById[id]?.name ?? id;
        const isCurrent = view.current === id && view.phase !== "gameOver";
        const canPick = selectable && pv.handCount > 0;
        const isPicked = selectedTarget === id;
        return (
          <button
            type="button"
            key={id}
            disabled={!canPick}
            onClick={() => onPickTarget(isPicked ? null : id)}
            className={[
              "flex flex-col items-stretch gap-1.5 rounded-xl px-3 py-2.5 min-w-[140px] text-left",
              "transition-all",
              canPick ? "cursor-pointer hover:ring-2 hover:ring-primary" : "cursor-default",
              isPicked ? "ring-2 ring-primary" : "",
              pv.handCount === 0 && !isCurrent ? "opacity-70" : "",
            ].join(" ")}
            style={{
              background:
                "color-mix(in oklch, var(--color-base-300) 35%, var(--color-base-100))",
              border: isCurrent
                ? "1.5px solid var(--color-primary)"
                : "1.5px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)",
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold truncate">{name}</span>
              <span
                className="text-[10px] uppercase tracking-[0.18em] text-base-content/60 font-semibold tabular"
                title="cards in hand"
              >
                {pv.handCount} card{pv.handCount === 1 ? "" : "s"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap min-h-[18px]">
              {pv.books.length === 0 ? (
                <span className="text-[10px] text-base-content/45 italic">
                  no books yet
                </span>
              ) : (
                pv.books.map((r, i) => <BookBadge key={`${r}-${i}`} rank={r} />)
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              {pv.handCount > 0 ? (
                Array.from({
                  length: Math.min(pv.handCount, 6),
                }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-[3px]"
                    style={{
                      width: 10,
                      height: 14,
                      background:
                        "repeating-linear-gradient(45deg, color-mix(in oklch, var(--color-primary) 55%, var(--color-base-100)) 0 3px, color-mix(in oklch, var(--color-primary) 30%, var(--color-base-100)) 3px 6px)",
                      marginLeft: i === 0 ? 0 : -4,
                      boxShadow:
                        "0 1px 0 oklch(0% 0 0 / 0.08), inset 0 0 0 0.5px color-mix(in oklch, var(--color-primary-content) 35%, transparent)",
                    }}
                  />
                ))
              ) : (
                <span className="text-[10px] text-base-content/45 italic">
                  empty hand
                </span>
              )}
              {pv.handCount > 6 && (
                <span className="text-[10px] text-base-content/45 ml-1">
                  +{pv.handCount - 6}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function YourSeat({
  hand,
  books,
  isMyTurn,
  availableRanks,
  selectedRank,
  onPickRank,
  onAsk,
  canSubmit,
  hasTarget,
  submitting,
}: {
  hand: Card[];
  books: Rank[];
  isMyTurn: boolean;
  availableRanks: Rank[];
  selectedRank: Rank | null;
  onPickRank: (r: Rank | null) => void;
  onAsk: () => void;
  canSubmit: boolean;
  hasTarget: boolean;
  submitting: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 md:p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 25%, var(--color-base-100))",
      }}
    >
      <div className="flex items-baseline gap-3 flex-wrap">
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
          Your hand
        </div>
        {!isMyTurn && (
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/45">
            Waiting for your turn
          </div>
        )}
        {books.length > 0 && (
          <div className="flex items-center gap-1 ml-auto flex-wrap">
            <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
              Your books
            </span>
            {books.map((r, i) => (
              <BookBadge key={`${r}-${i}`} rank={r} />
            ))}
          </div>
        )}
      </div>

      {hand.length === 0 ? (
        <div className="text-sm text-base-content/55 italic py-2">
          Your hand is empty — you'll be dealt back in when it's your turn if cards remain in the pond.
        </div>
      ) : (
        <div
          className="flex gap-2 flex-nowrap overflow-x-auto -mx-1 px-1 pb-1"
          style={{ scrollbarWidth: "thin" }}
        >
          {hand.map((c) => (
            <HandCard key={cardId(c)} card={c} size="md" />
          ))}
        </div>
      )}

      <div
        className="rounded-xl p-3 flex flex-col gap-2"
        style={{
          background:
            "color-mix(in oklch, var(--color-base-200) 70%, var(--color-base-100))",
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
          Ask for a rank
        </div>
        {availableRanks.length === 0 ? (
          <div className="text-xs text-base-content/55 italic">
            You have no cards to ask for.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {availableRanks.map((r) => {
              const active = selectedRank === r;
              return (
                <button
                  key={r}
                  type="button"
                  disabled={!isMyTurn}
                  onClick={() => onPickRank(active ? null : r)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors tabular min-w-[2.5rem]",
                    active
                      ? "text-primary-content"
                      : "text-base-content hover:bg-base-200",
                    !isMyTurn ? "opacity-60 cursor-not-allowed" : "",
                  ].join(" ")}
                  style={
                    active
                      ? {
                          background: "var(--color-primary)",
                          boxShadow: "inset 0 -1px 0 oklch(0% 0 0 / 0.2)",
                        }
                      : {
                          border:
                            "1px solid color-mix(in oklch, var(--color-base-content) 15%, transparent)",
                        }
                  }
                  aria-pressed={active}
                >
                  {r}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            className="btn btn-primary rounded-full px-5 font-semibold"
            disabled={!canSubmit}
            onClick={onAsk}
          >
            {submitting ? "Asking…" : "Ask"}
          </button>
          <span className="text-xs text-base-content/55">
            {!isMyTurn
              ? "Not your turn."
              : !hasTarget
                ? "Pick a player above, then a rank."
                : !selectedRank
                  ? "Pick a rank."
                  : "Ready — go for it."}
          </span>
        </div>
      </div>
    </div>
  );
}

function GameOverPanel({
  view,
  playersById,
  me,
}: {
  view: GoFishView;
  playersById: PlayerMap;
  me: PlayerId;
}) {
  const rows = view.players
    .map((id) => ({
      id,
      name: id === me ? "You" : playersById[id]?.name ?? id,
      books: view.perPlayer[id]?.books ?? [],
    }))
    .sort((a, b) => b.books.length - a.books.length);

  const topCount = rows[0]?.books.length ?? 0;
  return (
    <div
      className="rounded-2xl p-4 md:p-5 flex flex-col gap-3 parlor-win"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 20%, var(--color-base-100))",
        border:
          "1px solid color-mix(in oklch, var(--color-primary) 30%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Final standings
      </div>
      <ul className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const isTop = row.books.length === topCount && topCount > 0;
          return (
            <li
              key={row.id}
              className="flex items-center gap-2 flex-wrap rounded-lg px-3 py-2"
              style={{
                background: isTop
                  ? "color-mix(in oklch, var(--color-success) 14%, var(--color-base-100))"
                  : "color-mix(in oklch, var(--color-base-200) 40%, var(--color-base-100))",
                border: isTop
                  ? "1px solid color-mix(in oklch, var(--color-success) 45%, transparent)"
                  : "1px solid color-mix(in oklch, var(--color-base-content) 6%, transparent)",
              }}
            >
              <span className="font-semibold min-w-[6rem]">{row.name}</span>
              <span className="text-xs tabular text-base-content/65">
                {row.books.length} book{row.books.length === 1 ? "" : "s"}
              </span>
              <div className="flex items-center gap-1 flex-wrap">
                {row.books.map((r, i) => (
                  <BookBadge key={`${r}-${i}`} rank={r} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GoFishSummary({ view }: SummaryProps<GoFishView>) {
  if (view.phase !== "gameOver") return null;
  const winners = view.winners ?? [];
  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary mb-1">
        ◆ Result ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {winners.length === 1
          ? "A winner swims ashore."
          : winners.length > 1
            ? "The pond yields a tie."
            : "No books taken."}
      </div>
    </div>
  );
}

// ------------------------- Helpers -------------------------

const RANK_ORDER: Record<Rank, number> = {
  A: 0,
  "2": 1,
  "3": 2,
  "4": 3,
  "5": 4,
  "6": 5,
  "7": 6,
  "8": 7,
  "9": 8,
  "10": 9,
  J: 10,
  Q: 11,
  K: 12,
};

const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, D: 2, C: 3 };

function sortHand(hand: readonly Card[]): Card[] {
  return hand.slice().sort((a, b) => {
    const dr = RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
    if (dr !== 0) return dr;
    return (SUIT_ORDER[a.suit] ?? 0) - (SUIT_ORDER[b.suit] ?? 0);
  });
}

// ------------------------- Module -------------------------

export const goFishClientModule: ClientGameModule<
  GoFishView,
  GoFishMove,
  GoFishConfig
> = {
  type: GO_FISH_TYPE,
  Board: GoFishBoard,
  Summary: GoFishSummary,
};
