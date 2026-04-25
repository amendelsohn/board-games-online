import type { CSSProperties, ReactNode } from "react";
import {
  PlayerUILayout,
  type PlayerUIBreakpoint,
} from "./PlayerUILayout";

export interface HiddenRoleLayoutProps {
  /** Private info panel (your role, your team, secret knowledge). Sticky on desktop. */
  privatePanel: ReactNode;
  /** The current decision surface — vote, nomination, accusation, clue input, etc. */
  decision: ReactNode;
  /** Context rail: round history, player allegiance grid, vote tally. */
  contextRail?: ReactNode;
  /** Optional bar above for phase / round / timer indicators. */
  phaseBar?: ReactNode;
  /** Optional strip below for log / additional history. */
  log?: ReactNode;

  /** Pixel width of private panel. Default 300. */
  privateWidth?: number;
  /** Pixel width of context rail. Default 300. */
  contextWidth?: number;
  /** Container max width. Default 1500. */
  containerMaxWidth?: number | "none";
  gap?: number;
  unfoldAt?: PlayerUIBreakpoint;
  /** Make the private panel sticky on desktop. Default true. */
  stickyPrivate?: boolean;
  /** CSS top offset for sticky private panel. Default "1rem". */
  stickyOffset?: string;

  className?: string;
  style?: CSSProperties;
}

/**
 * Pattern wrapper for social-deduction games. Three-region desktop layout:
 * private panel pinned left (sticky — players glance at their role
 * constantly), the live decision surface in the middle, round history /
 * player roster on the right. Phase bar above, log strip below.
 *
 * Built for Avalon, Secret Hitler, Blood on the Clocktower, Spyfall,
 * Codenames, etc. Composes PlayerUILayout — fall back to that primitive if
 * a game needs a non-standard shape.
 */
export function HiddenRoleLayout({
  privatePanel,
  decision,
  contextRail,
  phaseBar,
  log,
  privateWidth = 300,
  contextWidth = 300,
  containerMaxWidth = 1500,
  gap,
  unfoldAt,
  stickyPrivate = true,
  stickyOffset = "1rem",
  className,
  style,
}: HiddenRoleLayoutProps) {
  const left = stickyPrivate ? (
    <div
      className="lg:sticky"
      style={{ top: stickyOffset }}
    >
      {privatePanel}
    </div>
  ) : (
    privatePanel
  );

  return (
    <PlayerUILayout
      topStrip={phaseBar}
      leftRail={left}
      main={decision}
      rightRail={contextRail}
      bottomStrip={log}
      leftRailWidth={privateWidth}
      rightRailWidth={contextWidth}
      containerMaxWidth={containerMaxWidth}
      gap={gap}
      unfoldAt={unfoldAt}
      className={className}
      style={style}
    />
  );
}
