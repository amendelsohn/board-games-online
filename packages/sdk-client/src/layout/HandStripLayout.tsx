import type { CSSProperties, ReactNode } from "react";
import {
  PlayerUILayout,
  type PlayerUIBreakpoint,
} from "./PlayerUILayout";

export interface HandStripLayoutProps {
  /** Opponents row at the top (other players' tableaus / hands / status). */
  opponents?: ReactNode;
  /** Central play surface — trick area, your tableau, the table state. */
  main: ReactNode;
  /** Wide bottom strip for the player's full hand of cards. */
  hand: ReactNode;
  /** Optional right rail for scoreboard, log, scoring legend. */
  contextRail?: ReactNode;

  /** Pixel width of the right rail. Default 240. */
  contextWidth?: number;
  /** Container max width. Default 1500. */
  containerMaxWidth?: number | "none";
  gap?: number;
  unfoldAt?: PlayerUIBreakpoint;

  className?: string;
  style?: CSSProperties;
}

/**
 * Pattern wrapper for trick-taking and large-hand card games. Opponents
 * along the top, the table / trick / your tableau in the middle, and the
 * player's hand as a wide strip across the bottom — full container width
 * so 13 cards (Hearts) or a 12-card pick-and-pass round (Sushi Go) lay
 * out comfortably.
 *
 * Mobile order favors the hand: opponents, table, hand, then context. The
 * hand is the decision surface in these games, so it sits above any
 * scoreboard / log when the layout collapses.
 *
 * Composes PlayerUILayout — drop to that primitive directly if a game
 * needs a different surface arrangement.
 */
export function HandStripLayout({
  opponents,
  main,
  hand,
  contextRail,
  contextWidth = 240,
  containerMaxWidth = 1500,
  gap,
  unfoldAt,
  className,
  style,
}: HandStripLayoutProps) {
  return (
    <PlayerUILayout
      topStrip={opponents}
      main={main}
      rightRail={contextRail}
      bottomStrip={hand}
      rightRailWidth={contextWidth}
      containerMaxWidth={containerMaxWidth}
      gap={gap}
      unfoldAt={unfoldAt}
      mobileOrder={["topStrip", "main", "bottomStrip", "rightRail"]}
      className={className}
      style={style}
    />
  );
}
