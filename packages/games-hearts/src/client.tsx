import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card as CardShell,
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
  type TrickEntry,
} from "./shared";

const PASS_COUNT = 3;

interface LegalResult {
  legal: boolean;
  reason: string | null;
}

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

  // Trick-completion hold: when currentTrick transitions 4→0, freeze the last
  // four plays for 1200ms so the user can see who won. Server exposes no
  // explicit `lastTrick` field, so we snapshot it ourselves from the trick
  // right before it clears.
  const prevTrickRef = useRef<TrickEntry[]>(view.currentTrick);
  const [trickHold, setTrickHold] = useState<{
    entries: TrickEntry[];
    winner: PlayerId | null;
    leadSuit: "C" | "D" | "H" | "S" | null;
    points: number;
  } | null>(null);
  useEffect(() => {
    const prev = prevTrickRef.current;
    prevTrickRef.current = view.currentTrick;
    if (prev.length === 4 && view.currentTrick.length === 0) {
      const leadSuit = prev[0]!.card.suit;
      // Trick winner: highest rank of cards following the lead suit.
      let winner: PlayerId | null = null;
      let winnerRank = -1;
      for (const e of prev) {
        if (e.card.suit === leadSuit && e.card.rank > winnerRank) {
          winnerRank = e.card.rank;
          winner = e.by;
        }
      }
      const points =
        prev.reduce((n, e) => n + (isHeart(e.card) ? 1 : 0), 0) +
        (prev.some((e) => isQueenOfSpades(e.card)) ? 13 : 0);
      setTrickHold({ entries: prev, winner, leadSuit, points });
      const t = setTimeout(() => setTrickHold(null), 1200);
      return () => clearTimeout(t);
    }
  }, [view.currentTrick]);

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

  /**
   * Explain legality. When illegal, `reason` is a short human-readable string
   * for tooltip display.
   */
  const legalStatus = (card: Card): LegalResult => {
    if (!isPlaying || !isMyTurn) return { legal: false, reason: null };
    const trick = view.currentTrick;
    const hand = view.hand;
    if (trick.length === 0) {
      const isFirstTrick = allTricksZero(view);
      if (isFirstTrick) {
        if (!isTwoOfClubs(card))
          return { legal: false, reason: "Lead with the 2 of clubs" };
        return { legal: true, reason: null };
      }
      if (isHeart(card) && !view.heartsBroken) {
        if (hand.every(isHeart)) return { legal: true, reason: null };
        return { legal: false, reason: "Hearts aren't broken yet" };
      }
      return { legal: true, reason: null };
    }
    const lead = view.leadSuit!;
    const hasLead = hand.some((c) => c.suit === lead);
    if (card.suit !== lead && hasLead)
      return { legal: false, reason: "Must follow suit" };
    const firstTrickApprox = totalTricksPlayed(view) === 0;
    if (firstTrickApprox && (isHeart(card) || isQueenOfSpades(card))) {
      const onlyBleed = hand.every((c) => isHeart(c) || isQueenOfSpades(c));
      if (!onlyBleed)
        return { legal: false, reason: "No bleeding on the first trick" };
    }
    return { legal: true, reason: null };
  };

  const playCard = async (card: Card) => {
    const { legal } = legalStatus(card);
    if (!legal || submitting) return;
    setSubmitting(true);
    try {
      await sendMove({ kind: "play", card });
    } finally {
      setSubmitting(false);
    }
  };

  // Penalty tracker: hearts visible in the current (or held) trick + the
  // queen of spades' location if she's been played.
  const visibleTrick = trickHold ? trickHold.entries : view.currentTrick;
  const heartsInVisibleTrick = visibleTrick.filter((e) => isHeart(e.card)).length;
  const queenEntry = visibleTrick.find((e) => isQueenOfSpades(e.card));

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <StatusBar
        view={view}
        me={me}
        playersById={playersById}
        isMyTurn={isMyTurn}
      />

      <PenaltyTracker
        view={view}
        heartsInTrick={heartsInVisibleTrick}
        queenEntry={queenEntry ?? null}
        playersById={playersById}
      />

      {/*
       * Layout: mobile stacks vertically; desktop (md+) uses a 3-column cross
       * with fixed edges to hold a stable center.
       */}
      <div className="w-full flex flex-col gap-4 md:grid md:grid-cols-[220px_1fr_220px] md:grid-rows-[auto_auto_auto] md:gap-6 md:max-w-5xl">
        {/* Opponents — mobile: single scroll row; desktop: cross */}
        <div className="md:hidden flex gap-2 overflow-x-auto -mx-2 px-2 py-1">
          <OpponentCard
            seat="left"
            view={view}
            playersById={playersById}
            pid={seating.left}
            compact
            isReceivingPass={isPassing}
          />
          <OpponentCard
            seat="top"
            view={view}
            playersById={playersById}
            pid={seating.top}
            compact
          />
          <OpponentCard
            seat="right"
            view={view}
            playersById={playersById}
            pid={seating.right}
            compact
          />
        </div>

        <div className="hidden md:flex md:col-start-2 md:row-start-1 justify-center">
          <OpponentCard
            seat="top"
            view={view}
            playersById={playersById}
            pid={seating.top}
          />
        </div>
        <div className="hidden md:flex md:col-start-1 md:row-start-2 items-center justify-center">
          <OpponentCard
            seat="left"
            view={view}
            playersById={playersById}
            pid={seating.left}
            isReceivingPass={isPassing}
          />
        </div>
        <div className="hidden md:flex md:col-start-3 md:row-start-2 items-center justify-center">
          <OpponentCard
            seat="right"
            view={view}
            playersById={playersById}
            pid={seating.right}
          />
        </div>

        {/* Center trick area */}
        <div className="flex justify-center md:col-start-2 md:row-start-2 md:items-center">
          <TrickArea
            view={view}
            seating={seating}
            trickHold={trickHold}
            playersById={playersById}
            isPassing={isPassing}
          />
        </div>

        {/* Bottom: self zone */}
        <div className="flex flex-col items-center gap-3 md:col-span-3 md:row-start-3">
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
            legalStatus={legalStatus}
            onSubmitPass={submitPass}
            submitting={submitting}
          />
        </div>
      </div>

      {isPassing && (
        <PassingHint
          iPassed={iPassed}
          selectedCount={selected.length}
          view={view}
          playersById={playersById}
          toName={playersById[seating.left]?.name ?? "left"}
        />
      )}
    </div>
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

/**
 * Penalty tracker — hearts visible on the current trick + Queen of Spades
 * status. Without server-side accumulators for hearts-taken/queen-owner, we
 * only report what's visible in the in-progress trick. The count resets
 * every trick, which is accurate for "what points are exposed right now."
 */
function PenaltyTracker({
  view,
  heartsInTrick,
  queenEntry,
  playersById,
}: {
  view: HeartsView;
  heartsInTrick: number;
  queenEntry: TrickEntry | null;
  playersById: Record<string, { id: string; name: string }>;
}) {
  if (view.phase !== "playing") return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-3 text-[10px] uppercase tracking-[0.16em] font-mono tabular-nums"
      style={{ color: "color-mix(in oklch, var(--color-base-content) 62%, transparent)" }}
    >
      <span className="flex items-center gap-1">
        <span style={{ color: "var(--color-error)" }}>♥</span>
        <span>
          on trick: <span className="text-base-content/90 font-semibold">{heartsInTrick}</span>
        </span>
      </span>
      <span className="text-base-content/30" aria-hidden>·</span>
      <span className="flex items-center gap-1">
        <span>Q♠:</span>
        {queenEntry ? (
          <span style={{ color: "var(--color-warning)" }}>
            <span className="mr-0.5">○</span>
            exposed by {playersById[queenEntry.by]?.name ?? queenEntry.by}
          </span>
        ) : (
          <span className="text-base-content/75">
            <span className="mr-0.5">●</span>still in play
          </span>
        )}
      </span>
    </div>
  );
}

function OpponentCard({
  seat,
  view,
  playersById,
  pid,
  compact,
  isReceivingPass,
}: {
  seat: "top" | "left" | "right";
  view: HeartsView;
  playersById: Record<string, { id: string; name: string }>;
  pid: PlayerId;
  compact?: boolean;
  /** Highlight this seat as the recipient of your pass (currently: left). */
  isReceivingPass?: boolean;
}) {
  const name = playersById[pid]?.name ?? pid;
  const handCount = view.handSizes[pid] ?? 0;
  const passed = view.passed[pid];
  const isCurrent = view.current === pid;
  const tricks = view.tricksWonCount[pid] ?? 0;
  const score = view.scores[pid] ?? 0;

  const fanVisible = compact ? Math.min(handCount, 3) : Math.min(handCount, 7);
  const fanSize: "xs" | "sm" = compact ? "xs" : "sm";
  const fanStagger = compact ? 7 : 11;
  const fanWidth = (fanSize === "xs" ? 32 : 44) + fanVisible * fanStagger;
  const fanHeight = fanSize === "xs" ? 46 : 64;

  const recvPassGlow = isReceivingPass
    ? {
        boxShadow:
          "0 0 0 1px color-mix(in oklch, var(--color-primary) 40%, transparent), 0 0 18px color-mix(in oklch, var(--color-primary) 20%, transparent)",
        borderColor: "color-mix(in oklch, var(--color-primary) 55%, transparent)",
        background: "color-mix(in oklch, var(--color-primary) 5%, var(--color-base-100))",
      }
    : null;

  return (
    <div
      className={[
        "flex gap-3 p-3 rounded-xl bg-base-100 border",
        isCurrent
          ? "ring-2 ring-primary border-primary/40"
          : "border-base-300/80",
        compact
          ? "flex-row items-center shrink-0 min-w-fit"
          : seat === "left" || seat === "right"
            ? "flex-col items-center"
            : "flex-row items-center",
      ].join(" ")}
      style={{
        boxShadow: isCurrent
          ? "0 0 0 2px var(--color-primary), 0 6px 16px color-mix(in oklch, var(--color-primary) 18%, transparent)"
          : "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
        ...(recvPassGlow ?? {}),
      }}
    >
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={[
              "font-semibold truncate text-sm",
              compact ? "max-w-[90px]" : "max-w-[160px]",
            ].join(" ")}
          >
            {name}
          </span>
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
        <div className="text-[10px] uppercase tracking-[0.2em] text-base-content/55 font-mono tabular-nums">
          {handCount}c · {tricks}t
          <span
            className={score > 0 ? "font-semibold text-base-content/85" : ""}
          >
            {" · "}
            {score}
            <span className="text-base-content/45">pt</span>
          </span>
        </div>
      </div>
      {fanVisible > 0 && (
        <div
          className="relative shrink-0"
          style={{ width: fanWidth, height: fanHeight }}
        >
          {Array.from({ length: fanVisible }).map((_, i) => (
            <div key={i} className="absolute top-0" style={{ left: i * fanStagger }}>
              <CardShell size={fanSize} faceDown ariaLabel="face-down card" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TrickArea({
  view,
  seating,
  trickHold,
  playersById,
  isPassing,
}: {
  view: HeartsView;
  seating: Seating;
  trickHold: {
    entries: TrickEntry[];
    winner: PlayerId | null;
    leadSuit: "C" | "D" | "H" | "S" | null;
    points: number;
  } | null;
  playersById: Record<string, { id: string; name: string }>;
  isPassing: boolean;
}) {
  const byPlayer: Record<PlayerId, Card | null> = {
    [seating.bottom]: null,
    [seating.left]: null,
    [seating.top]: null,
    [seating.right]: null,
  };
  const source = trickHold ? trickHold.entries : view.currentTrick;
  for (const entry of source) {
    byPlayer[entry.by] = entry.card;
  }
  const winningBy = trickHold?.winner ?? null;
  const winnerName = winningBy
    ? playersById[winningBy]?.name ?? winningBy
    : null;

  return (
    <div
      className="relative rounded-2xl p-4 mx-auto"
      style={{
        width: "min(92vw, 280px)",
        aspectRatio: "11 / 8",
        minHeight: 150,
        background:
          "radial-gradient(circle at 50% 50%, color-mix(in oklch, var(--color-success) 30%, var(--color-base-300)) 0%, var(--color-base-300) 85%)",
        boxShadow:
          "inset 0 1px 0 oklch(100% 0 0 / 0.12), inset 0 -2px 0 oklch(0% 0 0 / 0.18)",
      }}
    >
      {/* top */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2">
        <MaybeCard
          card={byPlayer[seating.top] ?? null}
          isWinner={winningBy === seating.top}
        />
      </div>
      {/* bottom */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
        <MaybeCard
          card={byPlayer[seating.bottom] ?? null}
          isWinner={winningBy === seating.bottom}
        />
      </div>
      {/* left */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <MaybeCard
          card={byPlayer[seating.left] ?? null}
          isWinner={winningBy === seating.left}
        />
      </div>
      {/* right */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <MaybeCard
          card={byPlayer[seating.right] ?? null}
          isWinner={winningBy === seating.right}
        />
      </div>

      {isPassing && !trickHold && (
        <PassArrow />
      )}

      {trickHold && winnerName && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bottom-[-34px] whitespace-nowrap text-[11px] uppercase tracking-[0.2em] font-bold px-2 py-0.5 rounded-full parlor-fade"
          style={{
            background:
              "color-mix(in oklch, var(--color-success) 18%, var(--color-base-100))",
            color: "var(--color-success)",
            border:
              "1px solid color-mix(in oklch, var(--color-success) 40%, transparent)",
          }}
        >
          {winnerName} takes {trickHold.points > 0 ? `+${trickHold.points}` : "0"}
        </div>
      )}
    </div>
  );
}

/** SVG arrow showing the pass direction (center → left). */
function PassArrow() {
  return (
    <svg
      viewBox="0 0 100 60"
      preserveAspectRatio="none"
      className="absolute inset-0 pointer-events-none"
      width="100%"
      height="100%"
      aria-hidden
    >
      <g
        stroke="color-mix(in oklch, var(--color-primary) 55%, transparent)"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          animation: "hearts-pass-slide 2.5s ease-in-out infinite",
        }}
      >
        <line x1="55" y1="30" x2="28" y2="30" />
        <polyline points="34,25 28,30 34,35" />
      </g>
      <text
        x="70"
        y="33"
        fontSize="7"
        fontFamily="var(--font-mono, monospace)"
        letterSpacing="0.14em"
        fill="color-mix(in oklch, var(--color-primary) 70%, transparent)"
      >
        PASS LEFT
      </text>
      <style>{`
        @keyframes hearts-pass-slide {
          0%, 100% { transform: translateX(0); opacity: 0.65; }
          50%      { transform: translateX(-4px); opacity: 1; }
        }
      `}</style>
    </svg>
  );
}

function MaybeCard({ card, isWinner }: { card: Card | null; isWinner?: boolean }) {
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
  return (
    <div
      style={
        isWinner
          ? {
              boxShadow:
                "0 0 0 3px var(--color-success), 0 0 20px color-mix(in oklch, var(--color-success) 48%, transparent)",
              borderRadius: 6,
            }
          : undefined
      }
    >
      <HandCard card={card} size="sm" />
    </div>
  );
}

function HandCard({
  card,
  size = "md",
  selected,
  disabled,
  onClick,
  disabledReason,
}: {
  card: Card;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  disabledReason?: string | null;
}) {
  return (
    <CardShell
      size={size}
      selected={selected}
      disabled={disabled}
      onClick={onClick}
      ariaLabel={disabledReason ? `${cardLabel(card)} — ${disabledReason}` : cardLabel(card)}
      style={disabledReason ? { cursor: "not-allowed" } : undefined}
    >
      <PlayingCardFace
        suit={card.suit as DeckSuit}
        rank={card.rank as DeckRank}
      />
      {disabledReason && (
        <span
          // Native title attribute gets us a cross-platform tooltip without
          // a positioned floating element. Stand-in until we ship a real
          // Parlor tooltip primitive.
          title={disabledReason}
          style={{ position: "absolute", inset: 0, display: "block" }}
          aria-hidden
        />
      )}
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
  legalStatus,
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
  legalStatus: (c: Card) => LegalResult;
  onSubmitPass: () => void;
  submitting: boolean;
}) {
  const iAmCurrent = view.current === me;
  const myScore = view.scores[me] ?? 0;
  return (
    <div className="flex flex-col items-center gap-2 w-full">
      <div
        className={[
          "text-[10px] uppercase tracking-[0.22em] font-mono tabular-nums",
          iAmCurrent ? "text-primary font-bold" : "text-base-content/55 font-semibold",
        ].join(" ")}
      >
        You · {view.tricksWonCount[me] ?? 0}t ·{" "}
        <span className={myScore > 0 ? "text-base-content/95 font-bold" : ""}>
          {myScore}
          <span className="text-base-content/45">pt</span>
        </span>
        {isOver && view.winner === me ? " · winner" : ""}
      </div>
      <div className="flex items-end justify-center flex-wrap gap-1">
        {view.hand.map((card) => {
          const isSel = selected.some((c) => cardsEqual(c, card));
          let disabled: boolean;
          let reason: string | null = null;
          if (isPassing) {
            disabled = iPassed;
          } else if (isPlaying) {
            const r = legalStatus(card);
            disabled = !r.legal;
            reason = r.reason;
          } else {
            disabled = true;
          }
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
              disabledReason={disabled && isPlaying ? reason : null}
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
  toName,
}: {
  iPassed: boolean;
  selectedCount: number;
  view: HeartsView;
  playersById: Record<string, { id: string; name: string }>;
  toName: string;
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
        : `Pick 3 cards to pass to ${toName} (left). ${selectedCount} selected.`}
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
