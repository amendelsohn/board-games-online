"use client";

import { registerClientModule } from "@bgo/sdk-client";
import { ticTacToeClientModule } from "@bgo/games-tictactoe/client";
import { connectFourClientModule } from "@bgo/games-connectfour/client";

let registered = false;

/** Idempotent — safe to call from any client entry point. */
export function registerAllClientGames(): void {
  if (registered) return;
  registerClientModule(ticTacToeClientModule);
  registerClientModule(connectFourClientModule);
  registered = true;
}
