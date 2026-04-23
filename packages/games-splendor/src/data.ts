import type { Card, Gem, Noble, Tier } from "./shared";

// Compact row encoding: [tier, points, bonus, white, blue, green, red, black]
type Row = [Tier, number, Gem, number, number, number, number, number];

const T1: Row[] = [
  // bonus white (8)
  [1, 0, "white", 0, 3, 0, 0, 0],
  [1, 0, "white", 0, 0, 2, 1, 0],
  [1, 0, "white", 3, 0, 0, 0, 0],
  [1, 0, "white", 0, 0, 1, 2, 0],
  [1, 0, "white", 1, 1, 1, 1, 0],
  [1, 0, "white", 1, 2, 1, 1, 1],
  [1, 0, "white", 0, 0, 0, 2, 1],
  [1, 1, "white", 0, 0, 0, 4, 0],
  // bonus blue (8)
  [1, 0, "blue", 1, 0, 1, 1, 1],
  [1, 0, "blue", 1, 0, 1, 2, 1],
  [1, 0, "blue", 0, 0, 2, 2, 0],
  [1, 0, "blue", 0, 0, 3, 0, 0],
  [1, 0, "blue", 0, 0, 0, 0, 3],
  [1, 0, "blue", 1, 0, 0, 0, 2],
  [1, 1, "blue", 0, 0, 0, 0, 4],
  [1, 0, "blue", 1, 0, 2, 0, 0],
  // bonus green (8)
  [1, 0, "green", 2, 1, 0, 0, 0],
  [1, 0, "green", 1, 1, 0, 1, 1],
  [1, 0, "green", 1, 2, 0, 1, 1],
  [1, 0, "green", 0, 3, 0, 0, 0],
  [1, 0, "green", 0, 0, 0, 3, 0],
  [1, 0, "green", 2, 0, 0, 0, 1],
  [1, 1, "green", 0, 0, 0, 0, 4],
  [1, 0, "green", 2, 2, 0, 0, 0],
  // bonus red (8)
  [1, 0, "red", 0, 2, 1, 0, 0],
  [1, 0, "red", 1, 1, 1, 0, 1],
  [1, 0, "red", 1, 1, 2, 0, 1],
  [1, 0, "red", 0, 0, 0, 0, 3],
  [1, 0, "red", 3, 0, 0, 0, 0],
  [1, 0, "red", 2, 1, 0, 0, 0],
  [1, 1, "red", 4, 0, 0, 0, 0],
  [1, 0, "red", 2, 0, 0, 2, 0],
  // bonus black (8)
  [1, 0, "black", 1, 1, 1, 1, 0],
  [1, 0, "black", 1, 1, 2, 1, 0],
  [1, 0, "black", 2, 0, 2, 0, 0],
  [1, 0, "black", 3, 0, 0, 0, 0],
  [1, 0, "black", 0, 3, 0, 0, 0],
  [1, 0, "black", 0, 1, 2, 0, 0],
  [1, 1, "black", 0, 4, 0, 0, 0],
  [1, 0, "black", 0, 2, 0, 2, 0],
];

const T2: Row[] = [
  // bonus white (6)
  [2, 1, "white", 0, 0, 3, 2, 2],
  [2, 1, "white", 0, 0, 0, 3, 3],
  [2, 2, "white", 0, 0, 1, 4, 2],
  [2, 2, "white", 0, 0, 0, 5, 3],
  [2, 2, "white", 0, 0, 0, 5, 0],
  [2, 3, "white", 0, 0, 0, 0, 6],
  // bonus blue (6)
  [2, 1, "blue", 2, 0, 3, 0, 2],
  [2, 1, "blue", 0, 2, 3, 0, 3],
  [2, 2, "blue", 2, 0, 0, 1, 4],
  [2, 2, "blue", 5, 3, 0, 0, 0],
  [2, 2, "blue", 5, 0, 0, 0, 0],
  [2, 3, "blue", 0, 6, 0, 0, 0],
  // bonus green (6)
  [2, 1, "green", 3, 0, 0, 2, 2],
  [2, 1, "green", 3, 3, 0, 0, 2],
  [2, 2, "green", 4, 2, 0, 0, 1],
  [2, 2, "green", 0, 5, 3, 0, 0],
  [2, 2, "green", 0, 0, 5, 0, 0],
  [2, 3, "green", 0, 0, 6, 0, 0],
  // bonus red (6)
  [2, 1, "red", 2, 3, 0, 0, 2],
  [2, 1, "red", 0, 3, 0, 2, 3],
  [2, 2, "red", 1, 4, 2, 0, 0],
  [2, 2, "red", 3, 0, 0, 0, 5],
  [2, 2, "red", 0, 0, 0, 5, 0],
  [2, 3, "red", 0, 0, 0, 6, 0],
  // bonus black (6)
  [2, 1, "black", 3, 2, 2, 0, 0],
  [2, 1, "black", 3, 0, 3, 0, 2],
  [2, 2, "black", 1, 2, 4, 0, 0],
  [2, 2, "black", 0, 0, 3, 5, 0],
  [2, 2, "black", 0, 0, 0, 0, 5],
  [2, 3, "black", 6, 0, 0, 0, 0],
];

const T3: Row[] = [
  // bonus white (4)
  [3, 3, "white", 0, 3, 3, 5, 3],
  [3, 4, "white", 0, 0, 0, 7, 0],
  [3, 4, "white", 3, 0, 0, 7, 3],
  [3, 5, "white", 0, 0, 0, 7, 3],
  // bonus blue (4)
  [3, 3, "blue", 3, 0, 3, 3, 5],
  [3, 4, "blue", 7, 0, 0, 0, 0],
  [3, 4, "blue", 7, 0, 3, 0, 3],
  [3, 5, "blue", 7, 3, 0, 0, 0],
  // bonus green (4)
  [3, 3, "green", 5, 3, 0, 3, 3],
  [3, 4, "green", 0, 7, 0, 0, 0],
  [3, 4, "green", 3, 7, 0, 3, 0],
  [3, 5, "green", 0, 7, 3, 0, 0],
  // bonus red (4)
  [3, 3, "red", 3, 5, 3, 0, 3],
  [3, 4, "red", 0, 0, 7, 0, 0],
  [3, 4, "red", 0, 3, 7, 3, 0],
  [3, 5, "red", 0, 0, 7, 3, 0],
  // bonus black (4)
  [3, 3, "black", 3, 3, 5, 3, 0],
  [3, 4, "black", 0, 0, 0, 0, 7],
  [3, 4, "black", 0, 3, 0, 3, 7],
  [3, 5, "black", 0, 0, 3, 0, 7],
];

function rowToCard(r: Row, idx: number): Card {
  const [tier, points, bonus, w, u, g, rr, k] = r;
  return {
    id: `t${tier}-${idx}`,
    tier,
    points,
    bonus,
    cost: { white: w, blue: u, green: g, red: rr, black: k },
  };
}

export const ALL_CARDS: Card[] = [
  ...T1.map((r, i) => rowToCard(r, i)),
  ...T2.map((r, i) => rowToCard(r, i + 100)),
  ...T3.map((r, i) => rowToCard(r, i + 200)),
];

export const ALL_NOBLES: Noble[] = [
  // 10 canonical-ish nobles. Each requires 3 bonuses of one color OR 4 of two.
  { id: "n1", points: 3, req: { white: 4, blue: 4, green: 0, red: 0, black: 0 } },
  { id: "n2", points: 3, req: { white: 0, blue: 4, green: 4, red: 0, black: 0 } },
  { id: "n3", points: 3, req: { white: 0, blue: 0, green: 4, red: 4, black: 0 } },
  { id: "n4", points: 3, req: { white: 0, blue: 0, green: 0, red: 4, black: 4 } },
  { id: "n5", points: 3, req: { white: 4, blue: 0, green: 0, red: 0, black: 4 } },
  { id: "n6", points: 3, req: { white: 3, blue: 3, green: 3, red: 0, black: 0 } },
  { id: "n7", points: 3, req: { white: 0, blue: 3, green: 3, red: 3, black: 0 } },
  { id: "n8", points: 3, req: { white: 0, blue: 0, green: 3, red: 3, black: 3 } },
  { id: "n9", points: 3, req: { white: 3, blue: 0, green: 0, red: 3, black: 3 } },
  { id: "n10", points: 3, req: { white: 3, blue: 3, green: 0, red: 0, black: 3 } },
];
