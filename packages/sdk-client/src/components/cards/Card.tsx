import type { CSSProperties, ReactNode } from "react";

export type CardSize = "xs" | "sm" | "md" | "lg" | "xl";

interface SizeSpec {
  w: number;
  h: number;
  radius: number;
}

const SIZES: Record<CardSize, SizeSpec> = {
  xs: { w: 32, h: 46, radius: 4 },
  sm: { w: 44, h: 64, radius: 5 },
  md: { w: 60, h: 86, radius: 7 },
  lg: { w: 80, h: 116, radius: 9 },
  xl: { w: 104, h: 148, radius: 12 },
};

export type CardHighlight =
  | "primary"
  | "secondary"
  | "accent"
  | "warning"
  | "error"
  | "info"
  | "success";

export interface CardProps {
  /** Pixel preset; the card auto-renders at the corresponding aspect ratio. */
  size?: CardSize;
  /** Render the themed back instead of children. */
  faceDown?: boolean;
  /** Lifts the card and adds a colored ring. */
  selected?: boolean;
  /** Dims the card; clicks ignored. Selected wins over disabled visually. */
  disabled?: boolean;
  /** Color of the selected ring + an attention border tint. */
  highlight?: CardHighlight;
  /** Renders as <button> when set. */
  onClick?: () => void;
  ariaLabel?: string;
  /** Visual is dimmed but not disabled (e.g. "this card is out of play"). */
  ghost?: boolean;
  /** Card face contents (SVG, text, mixed). */
  children?: ReactNode;
  /** Override the inline style if a game needs it. */
  style?: CSSProperties;
  /** Extra utility classes for spacing in a hand layout, etc. */
  className?: string;
}

/**
 * Themed card frame used by every card-based game. The face content goes in
 * children; for the standard 52-card deck use <PlayingCard> as the child.
 *
 * Visual intent: Parlor cardstock — warm ivory base, top/left highlight +
 * bottom/right shadow on the border, soft ambient drop. Lifts on hover when
 * interactive; lifts harder with a colored ring when selected.
 */
export function Card({
  size = "md",
  faceDown = false,
  selected = false,
  disabled = false,
  highlight,
  onClick,
  ariaLabel,
  ghost = false,
  children,
  style,
  className,
}: CardProps) {
  const dims = SIZES[size];
  const interactive = !!onClick && !disabled;
  const ring = highlight ? `var(--color-${highlight})` : "var(--color-primary)";

  const baseStyle: CSSProperties = {
    width: dims.w,
    height: dims.h,
    borderRadius: dims.radius,
    background: "var(--color-base-100)",
    color: "var(--color-base-content)",
    // Parlor cardstock: lit from top-left, weight on bottom-right.
    borderTop:
      "1px solid color-mix(in oklch, var(--color-base-content) 10%, transparent)",
    borderLeft:
      "1px solid color-mix(in oklch, var(--color-base-content) 8%, transparent)",
    borderRight:
      "1px solid color-mix(in oklch, var(--color-base-content) 18%, transparent)",
    borderBottom:
      "1px solid color-mix(in oklch, var(--color-base-content) 22%, transparent)",
    boxShadow: selected
      ? `0 0 0 2px ${ring}, 0 14px 40px color-mix(in oklch, ${ring} 22%, transparent)`
      : "0 1px 0 oklch(60% 0.05 60 / 0.06), 0 6px 18px oklch(25% 0.05 60 / 0.08)",
    opacity: ghost ? 0.55 : disabled && !selected ? 0.5 : 1,
    transition:
      "transform 200ms var(--ease-parlor), box-shadow 200ms var(--ease-parlor)",
    position: "relative",
    overflow: "hidden",
    padding: 0,
    display: "block",
    ...style,
  };

  const classes = [
    "shrink-0",
    interactive ? "cursor-pointer" : "cursor-default",
    interactive && !selected ? "hover:-translate-y-1" : "",
    selected ? "-translate-y-1.5" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const content = faceDown ? <CardBackArt radius={dims.radius} /> : children;

  if (interactive) {
    return (
      <button
        type="button"
        aria-label={ariaLabel}
        aria-pressed={selected || undefined}
        onClick={onClick}
        className={classes}
        style={baseStyle}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      className={classes}
      style={baseStyle}
    >
      {content}
    </div>
  );
}

/**
 * The card back. Rendered inside the shell when faceDown is set; not exported
 * directly because consumers should always go through <Card faceDown>.
 *
 * Pattern: warm primary diamond weave on a softened base, with a hairline
 * inner border so the back reads as "a card" even at xs sizes.
 */
function CardBackArt({ radius }: { radius: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: radius,
        background:
          // Diamond weave: two crossed repeating gradients in primary + secondary.
          "repeating-linear-gradient(45deg, color-mix(in oklch, var(--color-primary) 55%, var(--color-base-100)) 0 6px, color-mix(in oklch, var(--color-primary) 30%, var(--color-base-100)) 6px 12px)," +
          "repeating-linear-gradient(-45deg, color-mix(in oklch, var(--color-secondary) 24%, transparent) 0 6px, transparent 6px 12px)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: "8%",
          borderRadius: radius * 0.5,
          border:
            "1px solid color-mix(in oklch, var(--color-primary-content) 35%, transparent)",
          boxShadow:
            "inset 0 1px 0 oklch(100% 0 0 / 0.18), inset 0 -1px 0 oklch(0% 0 0 / 0.18)",
        }}
      />
    </div>
  );
}
