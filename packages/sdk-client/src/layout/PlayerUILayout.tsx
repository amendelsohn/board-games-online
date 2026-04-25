import type { CSSProperties, ReactNode } from "react";

export type PlayerUISlot =
  | "topStrip"
  | "leftRail"
  | "main"
  | "rightRail"
  | "bottomStrip";

export type PlayerUIBreakpoint = "md" | "lg" | "xl";

export interface PlayerUILayoutProps {
  topStrip?: ReactNode;
  leftRail?: ReactNode;
  main?: ReactNode;
  rightRail?: ReactNode;
  bottomStrip?: ReactNode;

  /** Pixel width of the left rail when un-stacked. Default 240. */
  leftRailWidth?: number;
  /** Pixel width of the right rail when un-stacked. Default 240. */
  rightRailWidth?: number;
  /** Pixel max width of the main slot when un-stacked. Default uncapped. */
  mainMaxWidth?: number;
  /** Pixel max width of the whole container. Default 1500. Pass "none" for uncapped. */
  containerMaxWidth?: number | "none";
  /** Gap between regions in rem. Default 1.5. */
  gap?: number;
  /** Tailwind breakpoint at which rails un-stack. Default "lg". */
  unfoldAt?: PlayerUIBreakpoint;
  /** Slot order when stacked. Absent slots are skipped. Default [topStrip, main, leftRail, rightRail, bottomStrip]. */
  mobileOrder?: PlayerUISlot[];
  /** Center the main slot horizontally when capped by mainMaxWidth. Default true. */
  centerMain?: boolean;

  className?: string;
  style?: CSSProperties;
}

const SLOT_AREA: Record<PlayerUISlot, string> = {
  topStrip: "top",
  leftRail: "left",
  main: "main",
  rightRail: "right",
  bottomStrip: "bottom",
};

const DEFAULT_MOBILE_ORDER: PlayerUISlot[] = [
  "topStrip",
  "main",
  "leftRail",
  "rightRail",
  "bottomStrip",
];

// Hand-rolled per breakpoint so Tailwind statically extracts the classes.
// Underscores in arbitrary values become spaces; quoted area rows are joined by spaces.
// We deliberately drive grid-template-areas via a CSS variable on mobile and a
// fixed string on desktop — setting it inline would beat any responsive class
// via specificity, freezing the layout in mobile mode at every viewport.
const UNFOLD_GRID: Record<PlayerUIBreakpoint, string> = {
  md: "md:[grid-template-columns:var(--pul-left)_minmax(0,1fr)_var(--pul-right)] md:[grid-template-areas:'top_top_top'_'left_main_right'_'bottom_bottom_bottom']",
  lg: "lg:[grid-template-columns:var(--pul-left)_minmax(0,1fr)_var(--pul-right)] lg:[grid-template-areas:'top_top_top'_'left_main_right'_'bottom_bottom_bottom']",
  xl: "xl:[grid-template-columns:var(--pul-left)_minmax(0,1fr)_var(--pul-right)] xl:[grid-template-areas:'top_top_top'_'left_main_right'_'bottom_bottom_bottom']",
};

/**
 * Slot-based responsive layout for in-match game UIs. Five optional regions:
 * topStrip, leftRail, main, rightRail, bottomStrip. Below the unfold breakpoint
 * everything stacks into a single column (order is configurable). Above it,
 * main expands while rails sit at fixed widths.
 *
 * This is a layout-only primitive — it does no theming, no padding inside slots,
 * no game-specific assumptions. Pattern wrappers (BoardLayout, HandActionLayout,
 * HiddenRoleLayout) compose it for common shapes; bespoke games can use it
 * directly or skip it entirely.
 */
export function PlayerUILayout({
  topStrip,
  leftRail,
  main,
  rightRail,
  bottomStrip,
  leftRailWidth = 240,
  rightRailWidth = 240,
  mainMaxWidth,
  containerMaxWidth = 1500,
  gap = 1.5,
  unfoldAt = "lg",
  mobileOrder = DEFAULT_MOBILE_ORDER,
  centerMain = true,
  className,
  style,
}: PlayerUILayoutProps) {
  const present: Record<PlayerUISlot, boolean> = {
    topStrip: topStrip != null,
    leftRail: leftRail != null,
    main: main != null,
    rightRail: rightRail != null,
    bottomStrip: bottomStrip != null,
  };

  const stackedAreas = mobileOrder
    .filter((s) => present[s])
    .map((s) => `"${SLOT_AREA[s]}"`)
    .join(" ");

  const containerStyle: CSSProperties = {
    "--pul-gap": `${gap}rem`,
    "--pul-left": present.leftRail ? `${leftRailWidth}px` : "0px",
    "--pul-right": present.rightRail ? `${rightRailWidth}px` : "0px",
    "--pul-areas": stackedAreas,
    maxWidth: containerMaxWidth === "none" ? undefined : `${containerMaxWidth}px`,
    width: "100%",
    marginLeft: "auto",
    marginRight: "auto",
    ...style,
  } as CSSProperties;

  const cls = [
    "grid grid-cols-1 gap-[var(--pul-gap)] [grid-template-areas:var(--pul-areas)]",
    UNFOLD_GRID[unfoldAt],
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  const mainStyle: CSSProperties | undefined = mainMaxWidth
    ? {
        maxWidth: `${mainMaxWidth}px`,
        width: "100%",
        marginLeft: centerMain ? "auto" : undefined,
        marginRight: centerMain ? "auto" : undefined,
      }
    : undefined;

  return (
    <div className={cls} style={containerStyle}>
      {present.topStrip && (
        <div className="[grid-area:top] min-w-0">{topStrip}</div>
      )}
      {present.leftRail && (
        <div className="[grid-area:left] min-w-0">{leftRail}</div>
      )}
      {present.main && (
        <div className="[grid-area:main] min-w-0" style={mainStyle}>
          {main}
        </div>
      )}
      {present.rightRail && (
        <div className="[grid-area:right] min-w-0">{rightRail}</div>
      )}
      {present.bottomStrip && (
        <div className="[grid-area:bottom] min-w-0">{bottomStrip}</div>
      )}
    </div>
  );
}
