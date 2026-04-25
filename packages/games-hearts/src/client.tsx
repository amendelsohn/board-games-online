import { useEffect, useMemo, useState } from "react";
import {
  Card as CardShell,
  PlayerUILayout,
  PlayingCard as PlayingCardFace,
  type Rank as DeckRank,
  type Suit as DeckSuit,
  type BoardProps,
  type ClientGameModule,
  type SummaryProps,
} from "@bgo/sdk-client";
import type { PlayerId } from "@bgo/sdk";
import {
  HEARTS_TYPE,
  cardKey,
  cardLabel,
  cardsEqual,
  isHeart,
  isQueenOfSpades,
  isTwoOfClubs,
  type Card,
  type HeartsMove,
  type HeartsView,
} from "./shared";

const PASS_COUNT = 3;

function HeartsBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<HeartsView, HeartsMove>) {
  const [selected, setSelected] = useState<Card[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const playersById = useMemo(() => {
    const m: Record<string, { id: string; name: string }> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  // Rotate seat layout so `me` is at the bottom.
  const seating = useMemo(() => layoutSeats(view.playerOrder, me), [view.playerOrder, me]);

  const phase = view.phase;
  const isPassing = phase === "passing";
  const isPlaying = phase === "playing";
  const isOver = phase === "gameOver";
  const iPassed = view.passed[me] === true;

  // Clear pass selections once we leave the passing phase.
  useEffect(() => {
    if (!isPassing) setSelected([]);
  }, [isPassing]);

  const toggleSelect = (card: Card) => {
    if (!isPassing || iPassed) return;
    setSelected((prev) => {
      const already = prev.find((c) => cardsEqual(c, card));
      if (already) return prev.filter((c) => !cardsEqual(c, card));
      if (prev.length >= PASS_COUNT) return prev;
      return [...prev, card];
    });
  };

  const submitPass = async () => {
    if (selected.length !== PASS_COUNT || submitting) return;
    setSubmitting(true);
    try {
      await sendMove({ kind: "pass", cards: selected });
      setSelected([]);
    } finally {
      setSubmitting(false);
    }
  };

  const legalToPlay = (card: Card): boolean => {
    if (!isPlaying || !isMyTurn) return false;
    const trick = view.currentTrick;
    const hand = view.hand;
    // Leading
    if (trick.length === 0) {
      const isFirstTrick = allTricksZero(view);
      if (isFirstTrick) return isTwoOfClubs(card);
      if (isHeart(card) && !view.heartsBroken) {
        return hand.every(isHeart);
      }
      return true;
    }
    const lead = view.leadSuit!;
    const hasLead = hand.some((c) => c.suit === lead);
    if (card.suit !== lead && hasLead) return false;
    // first trick bleed ban (we can't know server-side "first trick" exactly
    // here but handSizes can tell us: if everyone has 12 cards left after I
    // play -> first trick). Approximate via trick-count.
    const firstTrickApprox = totalTricksPlayed(view) === 0;
    if (firstTrickApprox && (isHeart(card) || isQueenOfSpades(card))) {
      const onlyBleed = hand.every((c) => isHeart(c) || isQueenOfSpades(c));
      if (!onlyBleed) return false;
    }
    return true;
  };

  const playCard = async (card: Card) => {
    if (!legalToPlay(card) || submitting) return;
    setSubmitting(true);
    try {
      await sendMove({ kind: "play", card });
    } finally {
      setSubmitting(false);
    }
  };

  const table = (
    <div className="grid grid-cols-[1fr_2fr_1fr] grid-rows-[auto_auto_auto] gap-4 w-full">
      {/* Top: north opponent */}
      <div className="col-start-2 row-start-1 flex justify-center">
        <OpponentCard
          seat="top"
          view={view}
          playersById={playersById}
          pid={seating.top}
        />
      </div>
      {/* Left opponent */}
      <div className="col-start-1 row-start-2 flex items-center justify-center">
        <OpponentCard
          seat="left"
          view={view}
          playersById={playersById}
          pid={seating.left}
        />
      </div>
      {/* Right opponent */}
      <div className="col-start-3 row-start-2 flex items-center justify-center">
        <OpponentCard
          seat="right"
          view={view}
          playersById={playersById}
          pid={seating.right}
        />
      </div>
      {/* Center trick area */}
      <div className="col-start-2 row-start-2 flex items-center justify-center">
        <TrickArea view={view} seating={seating} />
      </div>
      {/* Bottom: self zone spans all columns */}
      <div className="col-span-3 row-start-3 flex flex-col items-center gap-3">
        <SelfPanel
          view={view}
          me={me}
          selected={selected}
          isPassing={isPassing}
          iPassed={iPassed}
          isPlaying={isPlaying}
          isOver={isOver}
          onToggle={toggleSelect}
          onPlay={playCard}
          legalToPlay={legalToPlay}
          onSubmitPass={submitPass}
          submitting={submitting}
        />
      </div>
    </div>
  );

  const status = (
    <div className="flex justify-center">
      <StatusBar
        view={view}
        me={me}
        playersById={playersById}
        isMyTurn={isMyTurn}
      />
    </div>
  );

  const passingHint = isPassing ? (
    <PassingHint
      iPassed={iPassed}
      selectedCount={selected.length}
      view={view}
      playersById={playersById}
    />
  ) : undefined;

  return (
    <PlayerUILayout
      topStrip={status}
      main={table}
      bottomStrip={passingHint}
      containerMaxWidth={1100}
      mainMaxWidth={960}
      gap={1.25}
    />
  );
}

function allTricksZero(view: HeartsView): boolean {
  return Object.values(view.tricksWonCount).every((n) => n === 0) &&
    view.currentTrick.length === 0;
}

function totalTricksPlayed(view: HeartsView): number {
  return Object.values(view.tricksWonCount).reduce((a, b) => a + b, 0);
}

interface Seating {
  bottom: PlayerId;
  left: PlayerId;
  top: PlayerId;
  right: PlayerId;
}

/**
 * Rotate seat ring so `me` is at the bottom. The player whose seat follows
 * mine (+1) sits on the left, because they're the one who receives my pass.
 */
function layoutSeats(order: PlayerId[], me: PlayerId): Seating {
  const i = order.indexOf(me);
  const n = order.length;
  return {
    bottom: order[i]!,
    left: order[(i + 1) % n]!,
    top: order[(i + 2) % n]!,
    right: order[(i + 3) % n]!,
  };
}

function StatusBar({
  view,
  me,
  playersById,
  isMyTurn,
}: {
  view: HeartsView;
  me: PlayerId;
  playersById: Record<string, { id: string; name: string }>;
  isMyTurn: boolean;
}) {
  const label = (() => {
    if (view.phase === "gameOver") {
      if (view.isDraw) return "Draw.";
      const w = view.winner ? playersById[view.winner]?.name ?? view.winner : "—";
      return `${w} wins.`;
    }
    if (view.phase === "passing") {
      return view.passed[me] ? "Waiting for others to pass…" : "Pass 3 cards to your left.";
    }
    if (!view.current) return "";
    if (view.current === me) return "Your turn.";
    return `${playersById[view.current]?.name ?? view.current}'s turn.`;
  })();

  return (
    <div className="flex items-center gap-3 flex-wrap justify-center">
      <div
        className={[
          "px-4 py-1.5 rounded-full text-sm font-semibold",
          isMyTurn
            ? "bg-primary text-primary-content"
            : "bg-base-200 text-base-content",
        ].join(" ")}
        style={{
          boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -1px 0 oklch(0% 0 0 / 0.1)",
        }}
      >
        {label}
      </div>
      {view.heartsBroken && (
        <span
          className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.22em] font-semibold"
          style={{
            background: "color-mix(in oklch, var(--color-error) 20%, var(--color-base-100))",
            color: "var(--color-error)",
            border: "1px solid color-mix(in oklch, var(--color-error) 40%, transparent)",
          }}
        >
          Hearts broken
        </span>
      )}
    </div>
  );
}

function OpponentCard({
  seat,
  view,
  playersById,
  pid,
}: {
  seat: "top" | "left" | "right";
  view: HeartsView;
  playersById: Record<string, { id: string; name: string }>;
  pid: PlayerId;
}) {
  const name = playersById[pid]?.name ?? pid;
  const handCount = view.handSizes[pid] ?? 0;
  const passed = view.passed[pid];
  const isCurrent = view.current === pid;
  const tricks = view.tricksWonCount[pid] ?? 0;
  const score = view.scores[pid] ?? 0;
  const isOver = view.phase === "gameOver";

  // Draw face-down card fan (up to 5 visible for visual density).
  const visible = Math.min(handCount, 5);

  return (
    <div
      className={[
        "flex items-center gap-3 p-3 rounded-xl bg-base-100",
        isCurrent
          ? "ring-2 ring-primary"
          : "ring-1 ring-base-300/80",
        seat === "left" || seat === "right" ? "flex-col" : "flex-row",
      ].join(" ")}
      style={{
        boxShadow: isCurrent
          ? "0 0 0 2px var(--color-primary), 0 6px 16px color-mix(in oklch, var(--color-primary) 18%, transparent)"
          : "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
        minWidth: seat === "top" ? 180 : 120,
      }}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold truncate text-sm">{name}</span>
          {view.phase === "passing" && (
            <span
              className="text-[9px] uppercase tracking-[0.18em] font-bold"
              style={{
                color: passed ? "var(--color-success)" : "var(--color-base-content)",
                opacity: passed ? 1 : 0.45,
              }}
            >
              {passed ? "passed" : "pending"}
            </span>
          )}
        </div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-base-content/55 font-semibold">
          {handCount} card{handCount === 1 ? "" : "s"} · {tricks} tricks
          {isOver && ` · ${score} pts`}
        </div>
      </div>
      <div className="relative h-12" style={{ width: 32 + visible * 8 }}>
        {Array.from({ length: visible }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0"
            style={{ left: i * 8 }}
          >
            <CardShell size="xs" faceDown ariaLabel="face-down card" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TrickArea({
  view,
  seating,
}: {
  view: HeartsView;
  seating: Seating;
}) {
  const byPlayer: Record<PlayerId, Card | null> = {
    [seating.bottom]: null,
    [seating.left]: null,
    [seating.top]: null,
    [seating.right]: null,
  };
  for (const entry of view.currentTrick) {
    byPlayer[entry.by] = entry.card;
  }
  return (
    <div
      className="relative rounded-2xl p-4"
      style={{
        width: 220,
        height: 160,
        background:
          "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--color-success) 30%, var(--color-base-300)) 0%, var(--color-base-300) 85%)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -2px 0 oklch(0% 0 0 / 0.18)",
      }}
    >
      {/* top */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2">
        <MaybeCard card={byPlayer[seating.top] ?? null} />
      </div>
      {/* bottom */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <MaybeCard card={byPlayer[seating.bottom] ?? null} />
      </div>
      {/* left */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <MaybeCard card={byPlayer[seating.left] ?? null} />
      </div>
      {/* right */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <MaybeCard card={byPlayer[seating.right] ?? null} />
      </div>
    </div>
  );
}

function MaybeCard({ card }: { card: Card | null }) {
  if (!card) {
    return (
      <div
        style={{
          width: 44,
          height: 64,
          borderRadius: 5,
          border:
            "1px dashed color-mix(in oklch, var(--color-base-content) 22%, transparent)",
          opacity: 0.35,
        }}
      />
    );
  }
  return <HandCard card={card} size="sm" />;
}

function HandCard({
  card,
  size = "md",
  selected,
  disabled,
  onClick,
}: {
  card: Card;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <CardShell
      size={size}
      selected={selected}
      disabled={disabled}
      onClick={onClick}
      ariaLabel={cardLabel(card)}
    >
      <PlayingCardFace
        suit={card.suit as DeckSuit}
        rank={card.rank as DeckRank}
      />
    </CardShell>
  );
}

function SelfPanel({
  view,
  me,
  selected,
  isPassing,
  iPassed,
  isPlaying,
  isOver,
  onToggle,
  onPlay,
  legalToPlay,
  onSubmitPass,
  submitting,
}: {
  view: HeartsView;
  me: PlayerId;
  selected: Card[];
  isPassing: boolean;
  iPassed: boolean;
  isPlaying: boolean;
  isOver: boolean;
  onToggle: (c: Card) => void;
  onPlay: (c: Card) => void;
  legalToPlay: (c: Card) => boolean;
  onSubmitPass: () => void;
  submitting: boolean;
}) {
  const iAmCurrent = view.current === me;
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div
        className={[
          "text-[10px] uppercase tracking-[0.22em] font-semibold",
          iAmCurrent ? "text-primary" : "text-base-content/55",
        ].join(" ")}
      >
        You · {view.tricksWonCount[me] ?? 0} tricks{isOver ? ` · ${view.scores[me] ?? 0} pts` : ""}
      </div>
      <div className="flex items-end justify-center flex-wrap gap-1">
        {view.hand.map((card) => {
          const isSel = selected.some((c) => cardsEqual(c, card));
          const disabled = isPassing
            ? iPassed
            : isPlaying
              ? !legalToPlay(card)
              : true;
          const handler = isPassing
            ? () => onToggle(card)
            : isPlaying
              ? () => onPlay(card)
              : undefined;
          return (
            <HandCard
              key={cardKey(card)}
              card={card}
              size="md"
              selected={isSel}
              disabled={disabled || submitting}
              onClick={handler}
            />
          );
        })}
        {view.hand.length === 0 && !isOver && (
          <div className="text-sm text-base-content/50">Waiting…</div>
        )}
      </div>
      {isPassing && !iPassed && (
        <button
          type="button"
          onClick={onSubmitPass}
          disabled={selected.length !== PASS_COUNT || submitting}
          className="btn btn-primary rounded-full px-5 font-semibold"
        >
          Pass {selected.length}/{PASS_COUNT}
        </button>
      )}
    </div>
  );
}

function PassingHint({
  iPassed,
  selectedCount,
  view,
  playersById,
}: {
  iPassed: boolean;
  selectedCount: number;
  view: HeartsView;
  playersById: Record<string, { id: string; name: string }>;
}) {
  const pending = view.playerOrder.filter((pid) => !view.passed[pid]);
  return (
    <div className="max-w-xl w-full text-center text-xs text-base-content/55">
      {iPassed
        ? pending.length > 0
          ? `Waiting on ${pending
              .map((p) => playersById[p]?.name ?? p)
              .join(", ")}…`
          : "Resolving pass…"
        : `Pick 3 cards to pass LEFT. ${selectedCount} selected.`}
    </div>
  );
}

function HeartsSummary({ view }: SummaryProps<HeartsView>) {
  if (view.phase !== "gameOver") return null;
  const entries = view.playerOrder.map((pid) => ({
    pid,
    score: view.scores[pid] ?? 0,
  }));
  entries.sort((a, b) => a.score - b.score);
  return (
    <div className="surface-ivory max-w-md mx-auto px-6 py-5 flex flex-col gap-3">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary text-center">
        ◆ Final Scores ◆
      </div>
      <ul className="flex flex-col gap-1">
        {entries.map((e, i) => {
          const isWinner = !view.isDraw && view.winner === e.pid;
          return (
            <li
              key={e.pid}
              className="flex items-center justify-between gap-4 text-sm"
              style={{
                fontWeight: isWinner ? 700 : 500,
                color: isWinner ? "var(--color-success)" : undefined,
              }}
            >
              <span>
                {i + 1}. {e.pid}
              </span>
              <span className="font-mono tabular">{e.score}</span>
            </li>
          );
        })}
      </ul>
      {view.isDraw && (
        <div className="text-xs text-base-content/55 text-center">
          Multiple players tied for lowest score.
        </div>
      )}
    </div>
  );
}

export const heartsClientModule: ClientGameModule<
  HeartsView,
  HeartsMove,
  Record<string, never>
> = {
  type: HEARTS_TYPE,
  Board: HeartsBoard,
  Summary: HeartsSummary,
};
