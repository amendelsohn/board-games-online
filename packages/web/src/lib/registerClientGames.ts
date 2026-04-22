"use client";

import { registerClientModule } from "@bgo/sdk-client";
import { ticTacToeClientModule } from "@bgo/games-tictactoe/client";
import { connectFourClientModule } from "@bgo/games-connectfour/client";
import { codenamesClientModule } from "@bgo/games-codenames/client";
import { spyfallClientModule } from "@bgo/games-spyfall/client";
import { rpsClientModule } from "@bgo/games-rps/client";

let registered = false;

/** Idempotent — safe to call from any client entry point. */
export function registerAllClientGames(): void {
  if (registered) return;
  registerClientModule(ticTacToeClientModule);
  registerClientModule(connectFourClientModule);
  registerClientModule(codenamesClientModule);
  registerClientModule(spyfallClientModule);
  registerClientModule(rpsClientModule);
  registered = true;
}
