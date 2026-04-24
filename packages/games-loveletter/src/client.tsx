import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card as CardShell,
  type BoardProps,
  type CardSize,
  type ClientGameModule,
  type SummaryProps,
} from "@bgo/sdk-client";
import {
  ALL_RANKS,
  CARDS,
  DECK_COMPOSITION,
  GUARD_GUESS_RANKS,
  LOVE_LETTER_TYPE,
  type GuardGuessRank,
  type LogEntry,
  type LoveLetterConfig,
  type LoveLetterMove,
  type LoveLetterView,
  type Rank,
} from "./shared";

type PlayerMap = Record<string, { id: string; name: string }>;

const STARTING_COUNTS: Readonly<Record<Rank, number>> = (() => {
  const acc: Record<Rank, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
  for (const r of DECK_COMPOSITION) acc[r] += 1;
  return acc;
})();

function rankColor(rank: Rank): string {
  // Give each card a slightly different accent so rich-info decks look varied.
  switch (rank) {
    case 1:
      return "var(--color-info)";
    case 2:
      return "var(--color-success)";
    case 3:
      return "var(--color-warning)";
    case 4:
      return "var(--color-accent)";
    case 5:
      return "var(--color-secondary)";
    case 6:
      return "var(--color-primary)";
    case 7:
      return "var(--color-neutral)";
    case 8:
      return "var(--color-error)";
  }
}

// ------------------------- Small UI primitives -------------------------

function CardFace({
  rank,
  size = "md",
  dim,
  selected,
  onClick,
  showEliminatedStamp,
}: {
  rank: Rank;
  size?: CardSize;
  dim?: boolean;
  selected?: boolean;
  onClick?: () => void;
  showEliminatedStamp?: boolean;
}) {
  const def = CARDS[rank];
  return (
    <CardShell
      size={size}
      ghost={dim}
      selected={selected}
      onClick={onClick}
      ariaLabel={`${def.rank} · ${def.name} — ${def.effect}`}
    >
      <LoveLetterFace rank={rank} />
      {showEliminatedStamp && (
        <svg
          viewBox="0 0 100 140"
          preserveAspectRatio="xMidYMid meet"
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <g transform="translate(50 70) rotate(-15)">
            <rect
              x="-42"
              y="-12"
              width="84"
              height="24"
              rx="3"
              fill="none"
              stroke="var(--color-error)"
              strokeWidth="1.6"
              opacity="0.55"
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              fontSize="14"
              fontWeight={900}
              fontFamily="var(--font-display, serif)"
              fill="var(--color-error)"
              opacity="0.85"
              letterSpacing="0.12em"
            >
              ELIMINATED
            </text>
          </g>
        </svg>
      )}
      {/*
       * Native title attribute: cheap cross-platform tooltip with the
       * card's effect. Positioned tooltip primitive is a follow-up.
       */}
      <span
        title={`${def.name} (${def.rank}) — ${def.effect}`}
        aria-hidden
        style={{ position: "absolute", inset: 0, display: "block" }}
      />
    </CardShell>
  );
}

/**
 * Mini (inline) version of RankGlyph for deck composition chips. Uses a
 * tight viewBox + transform so the bespoke glyph paths render untouched at
 * ~14px — just scaled into a smaller frame.
 */
function MiniRankGlyph({ rank, size = 14 }: { rank: Rank; size?: number }) {
  const accent = rankColor(rank);
  return (
    <svg
      viewBox="-28 -28 56 56"
      width={size}
      height={size}
      style={{ display: "block", color: accent }}
      aria-label={CARDS[rank].name}
    >
      <RankGlyph rank={rank} />
    </svg>
  );
}

function CardBack({ size = "sm" }: { size?: CardSize }) {
  return <CardShell size={size} faceDown ariaLabel="opponent card, face down" />;
}

/**
 * Game-specific SVG card face for Love Letter. Each rank gets a small
 * pictogram in the parlor palette: shield, eye, swords, fan, crown, king's
 * crown, laurel, and a heart-rose for the Princess.
 */
function LoveLetterFace({ rank }: { rank: Rank }) {
  const def = CARDS[rank];
  const accent = rankColor(rank);
  return (
    <svg
      viewBox="0 0 100 140"
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ display: "block", color: accent }}
    >
      {/* Soft tinted background plate so each rank reads as its own color. */}
      <rect
        x="0"
        y="0"
        width="100"
        height="140"
        fill="currentColor"
        opacity="0.08"
      />
      <rect
        x="6"
        y="6"
        width="88"
        height="128"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.32"
      />
      {/* Top-left rank */}
      <text
        x="10"
        y="22"
        fontSize="15"
        fontWeight={700}
        fontFamily="var(--font-display, serif)"
        fill="currentColor"
        letterSpacing="-0.04em"
      >
        {def.rank}
      </text>
      {/* Bottom-right rank, rotated */}
      <g transform="translate(90, 130) rotate(180)">
        <text
          x="0"
          y="0"
          fontSize="15"
          fontWeight={700}
          fontFamily="var(--font-display, serif)"
          fill="currentColor"
          letterSpacing="-0.04em"
        >
          {def.rank}
        </text>
      </g>
      {/* Center pictogram */}
      <g transform="translate(50, 64)">
        <RankGlyph rank={rank} />
      </g>
      {/* Card name */}
      <text
        x="50"
        y="118"
        textAnchor="middle"
        fontSize="11"
        fontWeight={600}
        fontFamily="var(--font-display, serif)"
        fill="currentColor"
        letterSpacing="0.02em"
      >
        {def.name}
      </text>
    </svg>
  );
}

/**
 * The pictographic glyph for a Love Letter rank, drawn centered around (0,0)
 * within roughly a ±22 box. Stroke-based to keep the silhouette clean.
 */
function RankGlyph({ rank }: { rank: Rank }) {
  const stroke = "currentColor";
  const sw = 1.6;
  const cap = "round" as const;
  switch (rank) {
    case 1: // Guard — shield
      return (
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin={cap}
          strokeLinecap={cap}
        >
          <path d="M 0 -22 L 18 -16 L 18 -2 C 18 12, 8 20, 0 24 C -8 20, -18 12, -18 -2 L -18 -16 Z" />
          <path d="M -7 -4 L -2 4 L 9 -10" strokeWidth={sw + 0.4} />
        </g>
      );
    case 2: // Priest — eye
      return (
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin={cap}
          strokeLinecap={cap}
        >
          <path d="M -22 0 C -14 -14, 14 -14, 22 0 C 14 14, -14 14, -22 0 Z" />
          <circle cx="0" cy="0" r="6" />
          <circle cx="0" cy="0" r="2.4" fill={stroke} />
        </g>
      );
    case 3: // Baron — crossed swords
      return (
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin={cap}
          strokeLinecap={cap}
        >
          <line x1="-18" y1="-18" x2="18" y2="18" />
          <line x1="18" y1="-18" x2="-18" y2="18" />
          {/* hilts */}
          <line x1="-22" y1="-12" x2="-12" y2="-22" strokeWidth={sw + 0.6} />
          <line x1="12" y1="-22" x2="22" y2="-12" strokeWidth={sw + 0.6} />
          {/* pommels */}
          <circle cx="-21" cy="-21" r="2" fill={stroke} />
          <circle cx="21" cy="-21" r="2" fill={stroke} />
        </g>
      );
    case 4: // Handmaid — folded fan
      return (
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin={cap}
          strokeLinecap={cap}
        >
          <path d="M 0 18 L -22 -8 A 22 22 0 0 1 22 -8 Z" />
          <line x1="0" y1="18" x2="-16" y2="-2" />
          <line x1="0" y1="18" x2="-8" y2="-8" />
          <line x1="0" y1="18" x2="0" y2="-12" />
          <line x1="0" y1="18" x2="8" y2="-8" />
          <line x1="0" y1="18" x2="16" y2="-2" />
          <circle cx="0" cy="18" r="1.6" fill={stroke} />
        </g>
      );
    case 5: // Prince — small coronet
      return (
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin={cap}
          strokeLinecap={cap}
        >
          <path d="M -18 8 L -14 -10 L -6 0 L 0 -14 L 6 0 L 14 -10 L 18 8 Z" />
          <line x1="-18" y1="11" x2="18" y2="11" strokeWidth={sw + 0.4} />
          <circle cx="-14" cy="-12" r="1.6" fill={stroke} />
          <circle cx="0" cy="-16" r="1.8" fill={stroke} />
          <circle cx="14" cy="-12" r="1.6" fill={stroke} />
        </g>
      );
    case 6: // King — large crown with cross
      return (
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin={cap}
          strokeLinecap={cap}
        >
          <path d="M -20 12 L -16 -10 L -8 -2 L 0 -14 L 8 -2 L 16 -10 L 20 12 Z" />
          <line x1="-20" y1="15" x2="20" y2="15" strokeWidth={sw + 0.6} />
          {/* gemstones */}
          <circle cx="0" cy="-14" r="2" fill={stroke} />
          <circle cx="-16" cy="-10" r="1.6" fill={stroke} />
          <circle cx="16" cy="-10" r="1.6" fill={stroke} />
          {/* cross above */}
          <line x1="0" y1="-22" x2="0" y2="-16" strokeWidth={sw + 0.4} />
          <line x1="-3" y1="-19" x2="3" y2="-19" strokeWidth={sw + 0.4} />
        </g>
      );
    case 7: // Countess — laurel wreath
      return (
        <g
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinejoin={cap}
          strokeLinecap={cap}
        >
          <path d="M -20 6 C -22 -8, -14 -20, 0 -22 C 14 -20, 22 -8, 20 6" />
          {/* leaves left */}
          <path d="M -18 -4 q -4 -2 -6 0 q 2 4 6 4" />
          <path d="M -16 -10 q -4 -2 -6 0 q 2 4 6 4" />
          <path d="M -10 -16 q -4 -1 -6 1 q 2 4 6 4" />
          {/* leaves right */}
          <path d="M 18 -4 q 4 -2 6 0 q -2 4 -6 4" />
          <path d="M 16 -10 q 4 -2 6 0 q -2 4 -6 4" />
          <path d="M 10 -16 q 4 -1 6 1 q -2 4 -6 4" />
          {/* tie */}
          <path d="M -4 8 L 0 12 L 4 8" />
        </g>
      );
    case 8: // Princess — heart-rose
      return (
        <g stroke={stroke} strokeWidth={sw} strokeLinejoin={cap}>
          {/* heart base */}
          <path
            fill="currentColor"
            opacity="0.18"
            d="M 0 22 C -8 16, -22 6, -22 -6 C -22 -14, -14 -20, -8 -20 C -3 -20, 0 -16, 0 -12 C 0 -16, 3 -20, 8 -20 C 14 -20, 22 -14, 22 -6 C 22 6, 8 16, 0 22 Z"
          />
          <path
            fill="none"
            d="M 0 22 C -8 16, -22 6, -22 -6 C -22 -14, -14 -20, -8 -20 C -3 -20, 0 -16, 0 -12 C 0 -16, 3 -20, 8 -20 C 14 -20, 22 -14, 22 -6 C 22 6, 8 16, 0 22 Z"
          />
          {/* rose center */}
          <circle cx="0" cy="-2" r="6" fill="none" />
          <path d="M -3 -2 q 3 -4 6 0 q -3 4 -6 0 Z" fill={stroke} />
          <path d="M -1.5 -3.5 q 1.5 -2 3 0" fill="none" />
        </g>
      );
  }
}

// ------------------------- Board -------------------------

function LoveLetterBoard({
  view,
  me,
  players,
  isMyTurn,
  sendMove,
}: BoardProps<LoveLetterView, LoveLetterMove>) {
  const playersById: PlayerMap = useMemo(() => {
    const m: PlayerMap = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const myState = view.perPlayer[me];
  const myHand: Rank[] = myState?.hand ?? [];
  const isOver = view.phase === "gameOver";

  // Pending action UI: once you've clicked a card to play, we collect
  // target / guard-guess before dispatching the move.
  const [pending, setPending] = useState<
    | {
        cardIndex: 0 | 1;
        rank: Rank;
        target?: string;
        guess?: GuardGuessRank;
      }
    | null
  >(null);

  // Countess forced-play: computed so the UI can communicate.
  const mustPlayCountess =
    !isOver &&
    isMyTurn &&
    myHand.length === 2 &&
    myHand.includes(7) &&
    (myHand.includes(5) || myHand.includes(6));

  const otherPlayers = view.players.filter((id) => id !== me);

  const needsTarget = (r: Rank) =>
    r === 1 || r === 2 || r === 3 || r === 5 || r === 6;
  const needsGuess = (r: Rank) => r === 1;

  const hasValidOtherTarget = (r: Rank): boolean => {
    if (!needsTarget(r)) return true;
    const candidates = view.players.filter((id) => {
      if (id === me) return r === 5; // Prince allows self
      const v = view.perPlayer[id]!;
      if (v.eliminated) return false;
      if (v.immune) return false;
      return true;
    });
    return candidates.length > 0;
  };

  const canSubmitPending = (): boolean => {
    if (!pending) return false;
    if (needsTarget(pending.rank)) {
      // Guard/Priest/Baron/King may fizzle if no targets exist; allow submit
      // with undefined target in that case.
      if (!hasValidOtherTarget(pending.rank) && pending.rank !== 5) return true;
      if (!pending.target) return false;
    }
    if (needsGuess(pending.rank)) {
      // Guard may fizzle without a target; only require guess if there IS a target
      if (pending.target && !pending.guess) return false;
    }
    return true;
  };

  const startPlay = (cardIndex: 0 | 1) => {
    if (!isMyTurn || isOver) return;
    const rank = myHand[cardIndex];
    if (rank === undefined) return;

    // Enforce Countess rule client-side.
    if (mustPlayCountess && rank !== 7) return;

    // Fast-path cards with no configuration: Handmaid, Countess, Princess,
    // and effects that fizzle because everyone else is immune/eliminated.
    const needsCfg =
      (needsTarget(rank) && hasValidOtherTarget(rank)) ||
      (needsGuess(rank) && hasValidOtherTarget(rank));

    if (!needsCfg) {
      void sendMove({ kind: "play", cardIndex });
      setPending(null);
      return;
    }
    setPending({ cardIndex, rank });
  };

  const submitPending = async () => {
    if (!pending || !canSubmitPending()) return;
    const move: LoveLetterMove = {
      kind: "play",
      cardIndex: pending.cardIndex,
      ...(pending.target ? { target: pending.target } : {}),
      ...(pending.guess ? { guardGuess: pending.guess } : {}),
    };
    await sendMove(move);
    setPending(null);
  };

  const cancelPending = () => setPending(null);

  return (
    <div className="flex flex-col gap-4 w-full max-w-5xl mx-auto">
      <style>{`
        @keyframes love-turn-pulse {
          0%, 100% { box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 45%, transparent), 0 0 18px color-mix(in oklch, var(--color-primary) 18%, transparent); }
          50%      { box-shadow: 0 0 0 2px color-mix(in oklch, var(--color-primary) 60%, transparent), 0 0 30px color-mix(in oklch, var(--color-primary) 26%, transparent); }
        }
        @keyframes love-log-new {
          0%   { background: color-mix(in oklch, var(--color-primary) 22%, transparent); }
          100% { background: transparent; }
        }
      `}</style>
      <TopRibbon view={view} playersById={playersById} me={me} />

      <DeckTracker view={view} />

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-4">
        <div className="flex flex-col gap-4">
          <OpponentsRow
            view={view}
            me={me}
            playersById={playersById}
            pendingRank={pending?.rank ?? null}
            targetable={
              pending && needsTarget(pending.rank)
                ? view.players.filter((id) => {
                    if (id === me) return pending.rank === 5;
                    const v = view.perPlayer[id]!;
                    if (v.eliminated) return false;
                    if (v.immune) return false;
                    return true;
                  })
                : null
            }
            onPickTarget={(id) =>
              setPending((p) => (p ? { ...p, target: id } : p))
            }
            selectedTarget={pending?.target ?? null}
            log={view.log}
          />

          {view.revealed.length > 0 && (
            <RevealedStrip revealed={view.revealed} />
          )}

          <YourHand
            hand={myHand}
            isMyTurn={isMyTurn}
            isOver={isOver}
            mustPlayCountess={mustPlayCountess}
            onPlay={startPlay}
            pending={pending}
          />

          {pending && (
            <PendingPanel
              pending={pending}
              setGuess={(g) => setPending((p) => (p ? { ...p, guess: g } : p))}
              hasValidOtherTarget={hasValidOtherTarget(pending.rank)}
              canSubmit={canSubmitPending()}
              submit={submitPending}
              cancel={cancelPending}
            />
          )}
        </div>

        <LogPanel
          log={view.log}
          playersById={playersById}
          me={me}
        />
      </div>
    </div>
  );
}

// ------------------------- Sub-components -------------------------

function TopRibbon({
  view,
  playersById,
  me,
}: {
  view: LoveLetterView;
  playersById: PlayerMap;
  me: string;
}) {
  const currentName =
    playersById[view.current]?.name ?? view.current;
  const isMine = view.current === me;
  if (view.phase === "gameOver") {
    return (
      <div
        className="rounded-2xl px-5 py-3 text-center"
        style={{
          background: "color-mix(in oklch, var(--color-primary) 18%, var(--color-base-100))",
          border: "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
        }}
      >
        <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary">
          ◆ Hand complete ◆
        </div>
        <div
          className="font-display tracking-tight text-primary mt-0.5"
          style={{ fontSize: "var(--text-display-sm)" }}
        >
          {view.isDraw
            ? "The hand was a draw."
            : `${playersById[view.winner ?? ""]?.name ?? "?"} wins the hand.`}
        </div>
      </div>
    );
  }
  return (
    <div
      className="rounded-2xl px-5 py-3 flex items-center gap-4 flex-wrap"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 55%, var(--color-base-100))",
        animation: isMine
          ? "love-turn-pulse 2.4s ease-in-out infinite"
          : undefined,
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
      <div className="ml-auto flex items-center gap-3 text-xs text-base-content/65 font-mono tabular-nums">
        <div>
          Deck <span className="font-semibold">{view.deckCount}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * DeckTracker — strategic HUD. Shows remaining card counts derived from the
 * starting composition minus all publicly revealed cards. The server doesn't
 * expose `remainingByRank`, so we undercount (the figure reads as "at least
 * this many remain"). Flagged for a follow-up with team-lead.
 */
function DeckTracker({ view }: { view: LoveLetterView }) {
  // Count publicly-known out-of-deck cards per rank.
  const seen = useMemo(() => {
    const acc: Record<Rank, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0 };
    // Face-up revealed (2p setup).
    for (const r of view.revealed) acc[r] += 1;
    // Log-derived public discards / reveals.
    for (const e of view.log) {
      if (e.kind === "play") acc[e.card] += 1;
      else if (e.kind === "eliminated") acc[e.card] += 1;
      else if (e.kind === "princeDiscard") acc[e.discarded] += 1;
      else if (e.kind === "finalReveal") {
        for (const r of Object.values(e.hands)) acc[r] += 1;
      }
    }
    // Burned card, once revealed at gameOver.
    if (view.burned !== null) acc[view.burned] += 1;
    return acc;
  }, [view.revealed, view.log, view.burned]);

  const deckCount = view.deckCount;
  const stackFronts = Math.max(1, Math.min(3, Math.ceil(deckCount / 5)));

  return (
    <div
      className="rounded-2xl p-3 flex items-center gap-4 flex-wrap"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-200) 55%, var(--color-base-100))",
        border: "1px solid color-mix(in oklch, var(--color-base-content) 12%, transparent)",
      }}
    >
      {/* Stack visual */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="relative"
          style={{ width: 26, height: 38 }}
          aria-label={`draw pile, ${deckCount} cards`}
        >
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute rounded-[3px]"
              style={{
                width: 26,
                height: 38,
                top: -i * 2,
                left: -i * 2,
                background:
                  "color-mix(in oklch, var(--color-base-100) 90%, var(--color-base-300))",
                border:
                  "1px solid color-mix(in oklch, var(--color-base-content) 22%, transparent)",
                boxShadow: "inset 0 1px 0 oklch(100% 0 0 / 0.18), 0 1px 2px oklch(0% 0 0 / 0.12)",
                opacity: i < stackFronts ? 1 - i * 0.3 : 0,
              }}
            />
          ))}
        </div>
        <div className="flex flex-col">
          <span className="text-[9px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Draw pile
          </span>
          <span className="font-display font-bold tabular-nums text-lg leading-tight">
            {deckCount}
          </span>
        </div>
      </div>

      {/* Per-rank remaining chips */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {ALL_RANKS.map((r) => {
          const remaining = Math.max(0, STARTING_COUNTS[r] - seen[r]);
          const exhausted = remaining === 0;
          return (
            <div
              key={r}
              title={`${CARDS[r].name}: ${remaining} of ${STARTING_COUNTS[r]} remaining (public info)`}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full"
              style={{
                background: exhausted
                  ? "color-mix(in oklch, var(--color-base-300) 50%, transparent)"
                  : `color-mix(in oklch, ${rankColor(r)} 14%, var(--color-base-100))`,
                border: exhausted
                  ? "1px dashed color-mix(in oklch, var(--color-base-content) 22%, transparent)"
                  : `1px solid color-mix(in oklch, ${rankColor(r)} 40%, transparent)`,
                opacity: exhausted ? 0.5 : 1,
              }}
            >
              <span className="font-mono font-bold tabular-nums text-[10px]" style={{ color: exhausted ? undefined : rankColor(r) }}>
                {remaining}
                <span className="text-base-content/40">×</span>
              </span>
              <MiniRankGlyph rank={r} size={13} />
            </div>
          );
        })}
      </div>

      {/* Burned card slot */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <span className="text-[9px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
          Burned
        </span>
        {view.burned === null ? (
          <div
            className="rounded-[3px] flex items-center justify-center text-[9px] uppercase tracking-[0.18em] font-semibold text-base-content/40"
            style={{
              width: 26,
              height: 38,
              border:
                "1px dashed color-mix(in oklch, var(--color-base-content) 28%, transparent)",
            }}
          >
            ?
          </div>
        ) : (
          <div
            className="rounded-[3px] flex items-center justify-center text-[9px] font-bold"
            style={{
              width: 26,
              height: 38,
              background: `color-mix(in oklch, ${rankColor(view.burned)} 22%, var(--color-base-100))`,
              border: `1px solid color-mix(in oklch, ${rankColor(view.burned)} 55%, transparent)`,
              color: rankColor(view.burned),
            }}
          >
            {view.burned}
          </div>
        )}
      </div>
    </div>
  );
}

function OpponentsRow({
  view,
  me,
  playersById,
  targetable,
  pendingRank,
  onPickTarget,
  selectedTarget,
  log,
}: {
  view: LoveLetterView;
  me: string;
  playersById: PlayerMap;
  targetable: string[] | null;
  pendingRank: Rank | null;
  onPickTarget: (id: string) => void;
  selectedTarget: string | null;
  log: LogEntry[];
}) {
  // Tint the target-pick ring by the pending card's color so it reads as
  // "{card} will hit this player." Falls back to primary.
  const pickRingColor = pendingRank ? rankColor(pendingRank) : "var(--color-primary)";

  // For each eliminated opponent, find the elimination entry in the log so we
  // can annotate the card they held at elimination.
  const eliminatedHeldBy = useMemo(() => {
    const map: Record<string, Rank> = {};
    for (const e of log) {
      if (e.kind === "eliminated") {
        map[e.player] = e.card;
      }
    }
    return map;
  }, [log]);

  return (
    <div className="flex gap-3 flex-wrap">
      {view.players
        .filter((id) => id !== me)
        .map((id) => {
          const pv = view.perPlayer[id]!;
          const name = playersById[id]?.name ?? id;
          const canPick = targetable?.includes(id) ?? false;
          const isPicked = selectedTarget === id;
          const isCurrent = view.current === id && view.phase !== "gameOver";
          const heldRank = pv.eliminated ? eliminatedHeldBy[id] : undefined;
          return (
            <button
              type="button"
              key={id}
              disabled={!canPick}
              onClick={() => onPickTarget(id)}
              className={[
                "flex flex-col items-center gap-2 rounded-xl px-3 py-3 min-w-[120px]",
                "transition-all",
                canPick ? "cursor-pointer" : "cursor-default",
                pv.eliminated ? "opacity-60 grayscale" : "",
              ].join(" ")}
              style={{
                background:
                  "color-mix(in oklch, var(--color-base-300) 40%, var(--color-base-100))",
                border: isCurrent
                  ? "1.5px solid var(--color-primary)"
                  : "1.5px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)",
                boxShadow: isPicked
                  ? `0 0 0 2px ${pickRingColor}, 0 0 16px color-mix(in oklch, ${pickRingColor} 30%, transparent)`
                  : canPick
                    ? `0 0 0 0 ${pickRingColor}`
                    : undefined,
                outline: canPick && !isPicked ? `1px dashed color-mix(in oklch, ${pickRingColor} 55%, transparent)` : undefined,
                outlineOffset: 3,
              }}
            >
              {pv.eliminated && heldRank ? (
                <CardFace rank={heldRank} size="md" dim showEliminatedStamp />
              ) : pv.hand && pv.hand.length > 0 ? (
                <CardFace rank={pv.hand[0]!} size="md" dim={pv.eliminated} />
              ) : pv.handCount > 0 ? (
                <CardBack size="md" />
              ) : (
                <div
                  className="rounded-md flex items-center justify-center text-xs uppercase tracking-[0.18em] text-base-content/45 font-semibold"
                  style={{
                    width: 60,
                    height: 86,
                    border:
                      "1.5px dashed color-mix(in oklch, var(--color-base-content) 22%, transparent)",
                  }}
                >
                  out
                </div>
              )}
              <div className="text-sm font-semibold truncate max-w-[110px]">
                {name}
              </div>
              <div className="flex flex-col items-center gap-0.5 text-[10px] uppercase tracking-[0.18em] font-semibold">
                {pv.eliminated && (
                  <>
                    <span className="text-error">eliminated</span>
                    {heldRank !== undefined && (
                      <span
                        className="normal-case tracking-normal font-normal text-error/80"
                      >
                        held {CARDS[heldRank].name}
                      </span>
                    )}
                  </>
                )}
                {!pv.eliminated && pv.immune && (
                  <span className="text-accent">immune</span>
                )}
                {!pv.eliminated && !pv.immune && (
                  <span className="text-base-content/50">
                    {pv.handCount} card{pv.handCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
    </div>
  );
}

function RevealedStrip({ revealed }: { revealed: Rank[] }) {
  return (
    <div className="flex items-center gap-2">
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
        Revealed (out)
      </div>
      <div className="flex gap-1.5">
        {revealed.map((r, i) => (
          <div
            key={i}
            className="px-2 py-1 rounded-md text-xs font-semibold"
            style={{
              background: `color-mix(in oklch, ${rankColor(r)} 25%, var(--color-base-100))`,
              border: `1px solid color-mix(in oklch, ${rankColor(r)} 55%, transparent)`,
              color: rankColor(r),
            }}
          >
            {r} · {CARDS[r].name}
          </div>
        ))}
      </div>
    </div>
  );
}

function YourHand({
  hand,
  isMyTurn,
  isOver,
  mustPlayCountess,
  onPlay,
  pending,
}: {
  hand: Rank[];
  isMyTurn: boolean;
  isOver: boolean;
  mustPlayCountess: boolean;
  onPlay: (i: 0 | 1) => void;
  pending: { cardIndex: 0 | 1 } | null;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-300) 25%, var(--color-base-100))",
      }}
    >
      <div className="flex items-baseline gap-3">
        <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
          Your hand
        </div>
        {mustPlayCountess && (
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-warning">
            Countess must be played
          </div>
        )}
        {!isMyTurn && !isOver && (
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/45">
            Waiting for your turn
          </div>
        )}
      </div>
      <div className="flex gap-3 flex-wrap">
        {hand.length === 0 && (
          <div className="text-sm text-base-content/55 italic">
            You are out of the hand.
          </div>
        )}
        {hand.map((r, i) => {
          const cardIndex = i as 0 | 1;
          const canPlay =
            isMyTurn &&
            !isOver &&
            !pending &&
            (!mustPlayCountess || r === 7);
          const isPending = pending?.cardIndex === cardIndex;
          return (
            <CardFace
              key={i}
              rank={r}
              size="xl"
              selected={isPending}
              dim={!canPlay && !isPending}
              onClick={canPlay ? () => onPlay(cardIndex) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}

function PendingPanel({
  pending,
  setGuess,
  hasValidOtherTarget,
  canSubmit,
  submit,
  cancel,
}: {
  pending: {
    cardIndex: 0 | 1;
    rank: Rank;
    target?: string;
    guess?: GuardGuessRank;
  };
  setGuess: (g: GuardGuessRank) => void;
  hasValidOtherTarget: boolean;
  canSubmit: boolean;
  submit: () => void;
  cancel: () => void;
}) {
  const def = CARDS[pending.rank];
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{
        background:
          "color-mix(in oklch, var(--color-primary) 12%, var(--color-base-100))",
        border: "1px solid color-mix(in oklch, var(--color-primary) 40%, transparent)",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-primary">
        ◆ Playing {def.name} ({def.rank})
      </div>
      <div className="text-sm text-base-content/75">{def.effect}</div>

      {!hasValidOtherTarget && pending.rank !== 5 && (
        <div className="text-sm text-base-content/65 italic">
          Every other player is out or immune. This card has no effect.
        </div>
      )}

      {hasValidOtherTarget &&
        (pending.rank === 1 ||
          pending.rank === 2 ||
          pending.rank === 3 ||
          pending.rank === 6) && (
          <div className="text-xs text-base-content/65">
            Pick a target above.
          </div>
        )}

      {pending.rank === 5 && (
        <div className="text-xs text-base-content/65">
          Pick any player above — including yourself.
        </div>
      )}

      {pending.rank === 1 && pending.target && (
        <div className="flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55">
            Guess their card
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GUARD_GUESS_RANKS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setGuess(r)}
                className={[
                  "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors",
                  pending.guess === r
                    ? "text-primary-content"
                    : "text-base-content hover:bg-base-200",
                ].join(" ")}
                style={
                  pending.guess === r
                    ? {
                        background: rankColor(r),
                        boxShadow: "inset 0 -1px 0 oklch(0% 0 0 / 0.2)",
                      }
                    : {
                        border: `1px solid color-mix(in oklch, ${rankColor(r)} 35%, transparent)`,
                      }
                }
              >
                {r} · {CARDS[r].name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary rounded-full px-5 font-semibold"
          disabled={!canSubmit}
          onClick={submit}
        >
          Play {def.name}
        </button>
        <button
          type="button"
          className="btn btn-ghost rounded-full px-4"
          onClick={cancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function LogPanel({
  log,
  playersById,
  me,
}: {
  log: LogEntry[];
  playersById: PlayerMap;
  me: string;
}) {
  const nameOf = (id: string) => playersById[id]?.name ?? id;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const prevLen = useRef(log.length);

  // Auto-scroll to bottom on new entries. Always-scroll variant — simple,
  // predictable, and matches what players expect from a turn-by-turn log.
  useEffect(() => {
    if (log.length > prevLen.current) {
      const el = containerRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
    prevLen.current = log.length;
  }, [log.length]);

  // Count turns (each "play" entry starts a new turn) for grouping separators.
  let turnCounter = 0;

  return (
    <div
      ref={containerRef}
      className="rounded-2xl p-4 flex flex-col gap-2 min-h-[240px] max-h-[520px] overflow-y-auto"
      style={{
        background:
          "color-mix(in oklch, var(--color-base-200) 65%, var(--color-base-100))",
      }}
    >
      <div className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 sticky top-0 bg-inherit pb-1">
        History
      </div>
      {log.length === 0 && (
        <div className="text-xs text-base-content/50 italic">
          Play hasn't started yet.
        </div>
      )}
      <ul className="flex flex-col gap-1.5 text-xs leading-relaxed">
        {log.map((entry, i) => {
          const isNew = i >= prevLen.current && i === log.length - 1;
          const isPlay = entry.kind === "play";
          if (isPlay) turnCounter += 1;
          const showSeparator = isPlay && turnCounter > 1;
          return (
            <li
              key={i}
              className="text-base-content/80 rounded px-1"
              style={{
                animation: isNew
                  ? "love-log-new 1.5s ease-out"
                  : undefined,
              }}
            >
              {showSeparator && (
                <div className="text-[8px] uppercase tracking-[0.22em] text-base-content/40 border-t border-base-content/10 pt-1.5 mt-1 mb-1 font-mono tabular-nums">
                  Turn {turnCounter} · {isPlay ? nameOf((entry as { actor: string }).actor) : ""}
                </div>
              )}
              {renderLogEntry(entry, nameOf, me)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function renderLogEntry(
  e: LogEntry,
  nameOf: (id: string) => string,
  me: string,
): React.ReactNode {
  const nameOrYou = (id: string, subject: boolean) =>
    id === me ? (subject ? "You" : "you") : nameOf(id);
  if (e.kind === "play") {
    const card = CARDS[e.card];
    const actorIsMe = e.actor === me;
    const target = e.target ? ` → ${nameOrYou(e.target, false)}` : "";
    const guessPart =
      e.card === 1 && e.guess
        ? ` guessed ${CARDS[e.guess].name} (${e.guessCorrect ? "hit" : "miss"})`
        : "";
    const fizzle = e.fizzled ? " — no legal target, fizzled" : "";
    return (
      <span>
        <strong className="text-base-content">{nameOrYou(e.actor, true)}</strong>{" "}
        {actorIsMe ? "played" : "played"}{" "}
        <span style={{ color: rankColor(e.card) }} className="font-semibold">
          {card.name}
        </span>
        {target}
        {guessPart}
        {fizzle}
      </span>
    );
  }
  if (e.kind === "priestReveal") {
    if (e.revealedCard !== null) {
      if (e.looker === me) {
        return (
          <span className="italic">
            You saw <strong>{nameOf(e.target)}</strong>'s hand:{" "}
            <span style={{ color: rankColor(e.revealedCard) }}>
              {CARDS[e.revealedCard].name}
            </span>
          </span>
        );
      }
      if (e.target === me) {
        return (
          <span className="italic">
            <strong>{nameOf(e.looker)}</strong> saw your{" "}
            <span style={{ color: rankColor(e.revealedCard) }}>
              {CARDS[e.revealedCard].name}
            </span>
          </span>
        );
      }
    }
    return (
      <span className="italic text-base-content/55">
        <strong>{nameOf(e.looker)}</strong> secretly looked at{" "}
        <strong>{nameOf(e.target)}</strong>'s hand
      </span>
    );
  }
  if (e.kind === "baronReveal") {
    if (e.actorCard !== null && e.targetCard !== null) {
      // Participant view.
      const parts =
        e.loser === null
          ? " — tied, no elimination"
          : ` — ${nameOf(e.loser)} is out`;
      return (
        <span className="italic">
          <strong>{nameOf(e.actor)}</strong> (
          <span style={{ color: rankColor(e.actorCard) }}>
            {CARDS[e.actorCard].name}
          </span>
          ) vs <strong>{nameOf(e.target)}</strong> (
          <span style={{ color: rankColor(e.targetCard) }}>
            {CARDS[e.targetCard].name}
          </span>
          ){parts}
        </span>
      );
    }
    const outcome =
      e.loser === null
        ? "tied"
        : `${nameOf(e.loser)} was knocked out`;
    return (
      <span className="italic text-base-content/55">
        <strong>{nameOf(e.actor)}</strong> vs <strong>{nameOf(e.target)}</strong>{" "}
        Baron duel — {outcome}
      </span>
    );
  }
  if (e.kind === "eliminated") {
    const isMe = e.player === me;
    return (
      <span>
        <strong>{nameOrYou(e.player, true)}</strong> {isMe ? "are" : "is"} eliminated (held{" "}
        <span style={{ color: rankColor(e.card) }}>{CARDS[e.card].name}</span>)
      </span>
    );
  }
  if (e.kind === "swap") {
    return (
      <span>
        <strong>{nameOrYou(e.actor, true)}</strong> swapped hands with{" "}
        <strong>{nameOrYou(e.target, false)}</strong>
      </span>
    );
  }
  if (e.kind === "princeDiscard") {
    const from = e.drewFromBurned ? " (from the face-down card)" : "";
    const isMe = e.target === me;
    return (
      <span>
        <strong>{nameOrYou(e.target, true)}</strong> {isMe ? "discarded" : "discarded"}{" "}
        <span style={{ color: rankColor(e.discarded) }}>
          {CARDS[e.discarded].name}
        </span>{" "}
        and drew fresh{from}
      </span>
    );
  }
  if (e.kind === "handmaidImmune") {
    const isMe = e.actor === me;
    return (
      <span className="text-accent">
        <strong>{nameOrYou(e.actor, true)}</strong> {isMe ? "are" : "is"} immune until{" "}
        {isMe ? "your" : "their"} next turn
      </span>
    );
  }
  if (e.kind === "finalReveal") {
    const entries = Object.entries(e.hands);
    return (
      <span>
        Deck exhausted — remaining hands revealed:{" "}
        {entries
          .map(([id, r]) => `${nameOf(id)} ${CARDS[r as Rank].name}`)
          .join(", ")}
      </span>
    );
  }
  return null;
}

function LoveLetterSummary({ view }: SummaryProps<LoveLetterView>) {
  if (view.phase !== "gameOver") return null;
  return (
    <div className="surface-ivory max-w-xl mx-auto px-6 py-5 text-center">
      <div className="text-[10px] uppercase tracking-[0.3em] font-semibold text-primary mb-1">
        ◆ Result ◆
      </div>
      <div
        className="font-display tracking-tight"
        style={{ fontSize: "var(--text-display-sm)" }}
      >
        {view.isDraw
          ? "Draw"
          : view.winner
            ? "The last heart stands."
            : "Draw"}
      </div>
      {view.burned !== null && (
        <div className="flex items-center justify-center gap-3 mt-3">
          <CardFace rank={view.burned} size="sm" />
          <div className="text-sm text-base-content/65">
            Burned card was{" "}
            <span className="font-semibold" style={{ color: rankColor(view.burned) }}>
              {CARDS[view.burned].name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export const loveLetterClientModule: ClientGameModule<
  LoveLetterView,
  LoveLetterMove,
  LoveLetterConfig
> = {
  type: LOVE_LETTER_TYPE,
  Board: LoveLetterBoard,
  Summary: LoveLetterSummary,
};
