import type { CSSProperties, ReactNode } from "react";
import {
  PlayerUILayout,
  type PlayerUIBreakpoint,
} from "./PlayerUILayout";

export interface HandActionLayoutProps {
  /** Strip of opponent state (their hands / coin counts / status). Renders along the top. */
  opponents?: ReactNode;
  /** The active player's hand — the most prominent surface during their turn. */
  hand: ReactNode;
  /** Available actions for the active player (buttons, action cards, etc). */
  actions: ReactNode;
  /** Optional below-the-fold strip for game history / log. */
  history?: ReactNode;

  /** Fractional split of hand vs actions on desktop. Default [55, 45]. */
  splitRatio?: [number, number];
  /** Reverse the desktop order so actions sit on the left. Default false. */
  actionsFirst?: boolean;
  /** Container max width. Default 1500. */
  containerMaxWidth?: number | "none";
  gap?: number;
  /** Breakpoint at which the desktop split kicks in. Default "lg". */
  unfoldAt?: PlayerUIBreakpoint;

  className?: string;
  style?: CSSProperties;
}

const SPLIT_GRID: Record<PlayerUIBreakpoint, string> = {
  md: "md:[grid-template-columns:var(--hal-hand)_var(--hal-actions)]",
  lg: "lg:[grid-template-columns:var(--hal-hand)_var(--hal-actions)]",
  xl: "xl:[grid-template-columns:var(--hal-hand)_var(--hal-actions)]",
};

/**
 * Pattern wrapper: opponents along the top, the active player's hand and the
 * action picker side-by-side as the dominant surface, optional history strip
 * below. Built for hand-driven card games (Coup, Love Letter, Hanabi, Sushi
 * Go, etc.) where the player's private cards and the available actions are
 * both decision-critical and deserve real estate proportional to their role.
 *
 * Composes PlayerUILayout — drop to that primitive directly if a game needs
 * a different split shape.
 */
export function HandActionLayout({
  opponents,
  hand,
  actions,
  history,
  splitRatio = [55, 45],
  actionsFirst = false,
  containerMaxWidth = 1500,
  gap = 1.5,
  unfoldAt = "lg",
  className,
  style,
}: HandActionLayoutProps) {
  const [handFr, actionFr] = splitRatio;
  const splitStyle: CSSProperties = {
    "--hal-hand": `${actionsFirst ? actionFr : handFr}fr`,
    "--hal-actions": `${actionsFirst ? handFr : actionFr}fr`,
  } as CSSProperties;

  const splitCls = [
    "grid grid-cols-1 gap-[var(--pul-gap,1.5rem)]",
    SPLIT_GRID[unfoldAt],
  ].join(" ");

  const left = actionsFirst ? actions : hand;
  const right = actionsFirst ? hand : actions;

  const split = (
    <div className={splitCls} style={splitStyle}>
      <div className="min-w-0">{left}</div>
      <div className="min-w-0">{right}</div>
    </div>
  );

  return (
    <PlayerUILayout
      topStrip={opponents}
      main={split}
      bottomStrip={history}
      containerMaxWidth={containerMaxWidth}
      gap={gap}
      unfoldAt={unfoldAt}
      className={className}
      style={style}
    />
  );
}
