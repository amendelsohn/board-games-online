import type { ReactElement } from "react";

export type Suit = "C" | "D" | "H" | "S";

export const SUIT_COLOR: Record<Suit, string> = {
  H: "var(--color-error)",
  D: "var(--color-error)",
  C: "var(--color-base-content)",
  S: "var(--color-base-content)",
};

/**
 * Inline SVG suit shape. Designed in a 24×24 box; the consumer scales it
 * via transform. All four shapes are tuned to feel like a coherent set —
 * same visual weight, same baseline, same lobe radius.
 */
export function SuitShape({
  suit,
  fill = "currentColor",
}: {
  suit: Suit;
  fill?: string;
}): ReactElement {
  switch (suit) {
    case "H":
      // Heart: two lobes, gentle point at the bottom.
      return (
        <path
          fill={fill}
          d="M12 21.2 C7.8 17.5, 3.5 13.8, 3.5 9.2 C3.5 6.4, 5.7 4.3, 8.2 4.3 C9.9 4.3, 11.2 5.2, 12 6.6 C12.8 5.2, 14.1 4.3, 15.8 4.3 C18.3 4.3, 20.5 6.4, 20.5 9.2 C20.5 13.8, 16.2 17.5, 12 21.2 Z"
        />
      );
    case "D":
      // Diamond: gently rounded rhombus (still reads as a diamond at small sizes).
      return (
        <path
          fill={fill}
          d="M12 2.5 C12.6 2.5, 13 2.9, 13.4 3.4 L20.4 11.2 C20.8 11.6, 20.8 12.4, 20.4 12.8 L13.4 20.6 C13 21.1, 12.6 21.5, 12 21.5 C11.4 21.5, 11 21.1, 10.6 20.6 L3.6 12.8 C3.2 12.4, 3.2 11.6, 3.6 11.2 L10.6 3.4 C11 2.9, 11.4 2.5, 12 2.5 Z"
        />
      );
    case "S":
      // Spade: inverted heart with a triangular stem at the bottom.
      return (
        <path
          fill={fill}
          d="M12 2.8 C12 2.8, 3.5 9.5, 3.5 14.4 C3.5 16.7, 5.3 18.5, 7.5 18.5 C8.9 18.5, 10.1 17.8, 10.7 16.8 L9.5 21.4 L14.5 21.4 L13.3 16.8 C13.9 17.8, 15.1 18.5, 16.5 18.5 C18.7 18.5, 20.5 16.7, 20.5 14.4 C20.5 9.5, 12 2.8, 12 2.8 Z"
        />
      );
    case "C":
      // Club: three circles + a small stem.
      return (
        <g fill={fill}>
          <circle cx="12" cy="6.4" r="3.4" />
          <circle cx="6.6" cy="13.4" r="3.4" />
          <circle cx="17.4" cy="13.4" r="3.4" />
          <path d="M10.4 17 C10.4 17, 10.8 19.4, 9.5 21.4 L14.5 21.4 C13.2 19.4, 13.6 17, 13.6 17 Z" />
        </g>
      );
  }
}

export function rankText(rank: number): string {
  if (rank === 1 || rank === 14) return "A";
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  return String(rank);
}

export function suitName(suit: Suit): string {
  return suit === "H"
    ? "Hearts"
    : suit === "D"
      ? "Diamonds"
      : suit === "S"
        ? "Spades"
        : "Clubs";
}
