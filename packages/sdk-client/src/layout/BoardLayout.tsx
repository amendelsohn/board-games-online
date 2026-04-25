import type { CSSProperties, ReactNode } from "react";
import {
  PlayerUILayout,
  type PlayerUIBreakpoint,
  type PlayerUISlot,
} from "./PlayerUILayout";

export interface BoardLayoutProps {
  /** The game board itself. Centered and clamped to a square-friendly size. */
  board: ReactNode;
  /** Optional rail to the left of the board (e.g. captured pieces, opponent info). */
  leftRail?: ReactNode;
  /** Optional rail to the right of the board (e.g. move log, your info, score). */
  rightRail?: ReactNode;
  /** Optional bar above the board (e.g. turn badge, phase indicator). */
  statusBar?: ReactNode;
  /** Optional bar below the board (e.g. tool buttons, secondary controls). */
  toolbar?: ReactNode;

  /** CSS value clamping the board's max size. Default "min(80vh, 65vw)". */
  boardMaxSize?: string;
  /** Pixel width of left rail. Default 200. */
  leftRailWidth?: number;
  /** Pixel width of right rail. Default 200. */
  rightRailWidth?: number;
  /** Container max width. Default 1500. */
  containerMaxWidth?: number | "none";
  gap?: number;
  unfoldAt?: PlayerUIBreakpoint;
  /** Stack order on mobile. Default [statusBar, board, leftRail, rightRail, toolbar]. */
  mobileOrder?: PlayerUISlot[];

  className?: string;
  style?: CSSProperties;
}

/**
 * Pattern wrapper: central board with optional side rails, plus a status bar
 * above and a toolbar below. Built for abstract two-player games (chess,
 * checkers, reversi, gomoku, mancala, etc.) where the board is the primary
 * content and peripheral state (captured pieces, move log, clock, walls
 * remaining) sits in the rails.
 *
 * Composes PlayerUILayout — fall back to using PlayerUILayout directly if you
 * need a slot shape this wrapper doesn't model.
 */
export function BoardLayout({
  board,
  leftRail,
  rightRail,
  statusBar,
  toolbar,
  boardMaxSize = "min(80vh, 65vw)",
  leftRailWidth = 200,
  rightRailWidth = 200,
  containerMaxWidth = 1500,
  gap,
  unfoldAt,
  mobileOrder,
  className,
  style,
}: BoardLayoutProps) {
  const wrappedBoard = (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: boardMaxSize, aspectRatio: "var(--board-aspect, auto)" }}
    >
      {board}
    </div>
  );

  return (
    <PlayerUILayout
      topStrip={statusBar}
      leftRail={leftRail}
      main={wrappedBoard}
      rightRail={rightRail}
      bottomStrip={toolbar}
      leftRailWidth={leftRailWidth}
      rightRailWidth={rightRailWidth}
      containerMaxWidth={containerMaxWidth}
      gap={gap}
      unfoldAt={unfoldAt}
      mobileOrder={mobileOrder}
      className={className}
      style={style}
    />
  );
}
