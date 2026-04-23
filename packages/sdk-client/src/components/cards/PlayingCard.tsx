import type { ReactElement } from "react";
import {
  SUIT_COLOR,
  SuitShape,
  rankText,
  suitName,
  type Suit,
} from "./PlayingCardSuit";

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

/**
 * The face of a standard 52-card deck card. Designed to be a child of
 * <Card>; it fills its parent and uses currentColor for ink so the parent
 * controls the suit color.
 *
 * Visual style:
 * - viewBox 100×140 (5:7-ish playing card aspect)
 * - Top-left and bottom-right corner indices (rank above suit), the second
 *   pair rotated 180° so the card reads upright from either side.
 * - Numbers 2..10 use classical pip layouts; the bottom half pips are
 *   rotated 180°.
 * - Ace renders one large central pip.
 * - J/Q/K render a serif monogram with a small crown (K/Q) or sword (J)
 *   glyph, plus a discreet decorative frame.
 */
export function PlayingCard({
  suit,
  rank,
}: {
  suit: Suit;
  rank: Rank;
}): ReactElement {
  const color = SUIT_COLOR[suit];
  const W = 100;
  const H = 140;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      role="img"
      aria-label={`${rankText(rank)} of ${suitName(suit)}`}
      style={{ display: "block", color }}
    >
      <CornerIndex suit={suit} rank={rank} x={7} y={6} />
      <g transform={`rotate(180, ${W - 7 - 9}, ${H - 6 - 11})`}>
        <CornerIndex suit={suit} rank={rank} x={W - 7 - 18} y={H - 6 - 22} />
      </g>
      <CardCenter suit={suit} rank={rank} />
    </svg>
  );
}

function CornerIndex({
  suit,
  rank,
  x,
  y,
}: {
  suit: Suit;
  rank: Rank;
  x: number;
  y: number;
}) {
  const text = rankText(rank);
  // Tighter glyph for two-character "10".
  const fontSize = text.length === 2 ? 12 : 14;
  return (
    <g transform={`translate(${x}, ${y})`} fill="currentColor">
      <text
        x="0"
        y={fontSize}
        fontSize={fontSize}
        fontWeight={700}
        fontFamily="var(--font-display, serif)"
        letterSpacing="-0.04em"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </text>
      <g transform={`translate(0, ${fontSize + 1}) scale(0.42)`}>
        <SuitShape suit={suit} />
      </g>
    </g>
  );
}

function CardCenter({ suit, rank }: { suit: Suit; rank: Rank }) {
  if (rank === 1 || rank === 14) return <AceCenter suit={suit} />;
  if (rank === 11 || rank === 12 || rank === 13)
    return <FaceCenter suit={suit} rank={rank as 11 | 12 | 13} />;
  return <PipLayout suit={suit} rank={rank as PipRank} />;
}

function AceCenter({ suit }: { suit: Suit }) {
  // One large central pip.
  return (
    <g transform="translate(50, 70)">
      <g transform="translate(-22, -22) scale(1.85)">
        <SuitShape suit={suit} />
      </g>
    </g>
  );
}

type PipRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Geometric pip arrangement on the card body. Coordinates are in viewBox
 * pixels (100×140); pips are centered. Bottom-half pips are flipped vertically
 * so the layout reads correctly from either side of the table.
 */
function PipLayout({ suit, rank }: { suit: Suit; rank: PipRank }) {
  // Column x-positions and the row y-positions we'll mix and match per rank.
  const xL = 32;
  const xC = 50;
  const xR = 68;
  const yTop = 32;
  const yQ1 = 50;
  const yMid = 70;
  const yQ3 = 90;
  const yBot = 108;

  // Each entry: [x, y, flipped].
  const pips: Array<[number, number, boolean]> = (() => {
    switch (rank) {
      case 2:
        return [
          [xC, yTop, false],
          [xC, yBot, true],
        ];
      case 3:
        return [
          [xC, yTop, false],
          [xC, yMid, false],
          [xC, yBot, true],
        ];
      case 4:
        return [
          [xL, yTop, false],
          [xR, yTop, false],
          [xL, yBot, true],
          [xR, yBot, true],
        ];
      case 5:
        return [
          [xL, yTop, false],
          [xR, yTop, false],
          [xC, yMid, false],
          [xL, yBot, true],
          [xR, yBot, true],
        ];
      case 6:
        return [
          [xL, yTop, false],
          [xR, yTop, false],
          [xL, yMid, false],
          [xR, yMid, false],
          [xL, yBot, true],
          [xR, yBot, true],
        ];
      case 7:
        return [
          [xL, yTop, false],
          [xR, yTop, false],
          [xC, (yTop + yMid) / 2, false],
          [xL, yMid, false],
          [xR, yMid, false],
          [xL, yBot, true],
          [xR, yBot, true],
        ];
      case 8:
        return [
          [xL, yTop, false],
          [xR, yTop, false],
          [xC, (yTop + yMid) / 2, false],
          [xL, yMid, false],
          [xR, yMid, false],
          [xC, (yMid + yBot) / 2, true],
          [xL, yBot, true],
          [xR, yBot, true],
        ];
      case 9:
        return [
          [xL, yTop, false],
          [xR, yTop, false],
          [xL, yQ1, false],
          [xR, yQ1, false],
          [xC, yMid, false],
          [xL, yQ3, true],
          [xR, yQ3, true],
          [xL, yBot, true],
          [xR, yBot, true],
        ];
      case 10:
        return [
          [xL, yTop, false],
          [xR, yTop, false],
          [xC, (yTop + yQ1) / 2 + 2, false],
          [xL, yQ1 + 2, false],
          [xR, yQ1 + 2, false],
          [xL, yQ3 - 2, true],
          [xR, yQ3 - 2, true],
          [xC, (yQ3 + yBot) / 2 - 2, true],
          [xL, yBot, true],
          [xR, yBot, true],
        ];
    }
  })();

  // Pip glyph is drawn from a 24×24 viewBox; scale to ~16px.
  const PIP_SCALE = 0.7;
  const PIP_HALF = 12 * PIP_SCALE;
  return (
    <g>
      {pips.map(([x, y, flipped], i) => (
        <g
          key={i}
          transform={`translate(${x - PIP_HALF}, ${y - PIP_HALF}) ${
            flipped ? `rotate(180, ${PIP_HALF}, ${PIP_HALF})` : ""
          } scale(${PIP_SCALE})`}
        >
          <SuitShape suit={suit} />
        </g>
      ))}
    </g>
  );
}

function FaceCenter({ suit, rank }: { suit: Suit; rank: 11 | 12 | 13 }) {
  const letter = rank === 11 ? "J" : rank === 12 ? "Q" : "K";
  return (
    <g>
      {/* Decorative inner frame */}
      <rect
        x="14"
        y="22"
        width="72"
        height="96"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.35"
      />
      {/* Glyph above the monogram: crown for K/Q, sword for J */}
      <g transform="translate(50, 46)">
        {rank === 13 && <CrownGlyph variant="king" />}
        {rank === 12 && <CrownGlyph variant="queen" />}
        {rank === 11 && <SwordGlyph />}
      </g>
      {/* Big serif monogram */}
      <text
        x="50"
        y="92"
        textAnchor="middle"
        fontSize="42"
        fontWeight={700}
        fontFamily="var(--font-display, serif)"
        fill="currentColor"
        letterSpacing="-0.04em"
      >
        {letter}
      </text>
      {/* Small suit pip beneath the monogram */}
      <g transform="translate(40, 100) scale(0.85)">
        <SuitShape suit={suit} />
      </g>
    </g>
  );
}

function CrownGlyph({ variant }: { variant: "king" | "queen" }) {
  // Centered around (0,0), draws within roughly ±14 horizontally.
  // King has three points + crossbar, queen has five gentler points.
  if (variant === "king") {
    return (
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path d="M -14 4 L -10 -8 L -4 0 L 0 -10 L 4 0 L 10 -8 L 14 4 Z" />
        <line x1="-14" y1="6" x2="14" y2="6" />
        <line x1="-1.4" y1="-12" x2="1.4" y2="-12" />
        <line x1="0" y1="-13.4" x2="0" y2="-10.6" />
      </g>
    );
  }
  // Queen — softer five-point coronet.
  return (
    <g
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M -14 4 Q -12 -6, -8 -3 Q -4 -10, 0 -4 Q 4 -10, 8 -3 Q 12 -6, 14 4 Z" />
      <line x1="-14" y1="6" x2="14" y2="6" />
      <circle cx="-9" cy="-5" r="1.2" fill="currentColor" />
      <circle cx="0" cy="-6" r="1.4" fill="currentColor" />
      <circle cx="9" cy="-5" r="1.2" fill="currentColor" />
    </g>
  );
}

function SwordGlyph() {
  // Centered around (0, 0); a vertical sword silhouette.
  return (
    <g fill="currentColor">
      <rect x="-1.2" y="-12" width="2.4" height="18" />
      <rect x="-7" y="6" width="14" height="2" />
      <rect x="-1" y="8" width="2" height="3" />
    </g>
  );
}
