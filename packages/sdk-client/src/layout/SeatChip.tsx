import type { CSSProperties, ReactNode } from "react";

export interface SeatChipProps {
  /** The seat's visual identity — color disc, piece glyph, dot, mini-card. */
  swatch: ReactNode;
  /** Small uppercase eyebrow label, e.g. "Black · to move", "Red · to drop". */
  label: ReactNode;
  /** The seat's display name. */
  name: string;
  /** Append "(you)" after the name. */
  isYou?: boolean;
  /** Trailing inline content — score, material delta, last-move marker. */
  meta?: ReactNode;
  /** Render the active-turn ring. */
  active?: boolean;
  /** CSS color for the active ring. Defaults to var(--color-primary). */
  accent?: string;
  /** Lay out content left-to-right (start) or right-to-left (end). */
  align?: "start" | "end";

  className?: string;
  style?: CSSProperties;
}

/**
 * Compact horizontal seat chip used in BoardLayout top-strips. Shows the
 * seat's identity at a glance: a swatch (color disc / piece glyph / token),
 * a small eyebrow label (color name + active verb), the player's name with
 * an optional "(you)" tag, and a trailing meta slot for score, material
 * delta, last-move column, etc.
 *
 * The active-turn ring uses `accent` (defaults to var(--color-primary)) so
 * games can light up the chip in the seat's own color (e.g. red/gold for
 * Connect Four) when that reads better than a generic primary.
 */
export function SeatChip({
  swatch,
  label,
  name,
  isYou = false,
  meta,
  active = false,
  accent = "var(--color-primary)",
  align = "start",
  className,
  style,
}: SeatChipProps) {
  const cls = [
    "rounded-2xl px-3 py-2 flex items-center gap-3 min-w-0 max-w-full",
    align === "end" ? "flex-row-reverse text-right" : "flex-row",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const baseStyle: CSSProperties = {
    background:
      "color-mix(in oklch, var(--color-base-100) 85%, transparent)",
    boxShadow: active
      ? `inset 0 0 0 2px ${accent}, 0 6px 16px color-mix(in oklch, ${accent} 18%, transparent)`
      : "inset 0 1px 0 oklch(100% 0 0 / 0.1), inset 0 -1px 0 oklch(0% 0 0 / 0.05)",
    ...style,
  };

  return (
    <div className={cls} style={baseStyle}>
      <div className="shrink-0 flex items-center justify-center">{swatch}</div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-[0.22em] font-semibold text-base-content/55 leading-tight">
          {label}
        </span>
        <span
          className="font-display tracking-tight truncate leading-tight"
          style={{ fontSize: "1rem" }}
        >
          {name}
          {isYou && (
            <span className="text-base-content/55 font-sans text-xs ml-1">
              (you)
            </span>
          )}
          {meta != null && <span className="ml-2">{meta}</span>}
        </span>
      </div>
    </div>
  );
}

export interface SeatStripProps {
  /** Left-aligned chip — usually the opponent. */
  left: ReactNode;
  /** Center status — turn indicator, phase, etc. */
  center?: ReactNode;
  /** Right-aligned chip — usually you. */
  right: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Convenience wrapper for the two-seat-with-center-status row that sits
 * in BoardLayout's statusBar slot. Stacks vertically on mobile, lays out
 * as a 1fr / auto / 1fr grid on `sm:` and up.
 */
export function SeatStrip({
  left,
  center,
  right,
  className,
  style,
}: SeatStripProps) {
  const cls = [
    "flex flex-col sm:grid sm:grid-cols-[1fr_auto_1fr] items-stretch sm:items-center gap-2 sm:gap-3 w-full",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} style={style}>
      {left}
      {center !== undefined && (
        <div className="text-[10px] sm:text-xs uppercase tracking-[0.22em] font-semibold text-center px-2">
          {center}
        </div>
      )}
      {right}
    </div>
  );
}
