import type { PlayerId } from "./types";

export type Outcome =
  | { kind: "solo"; winners: PlayerId[]; losers: PlayerId[] }
  | { kind: "team"; winningTeam: string; losingTeams: string[] }
  | { kind: "draw" };
