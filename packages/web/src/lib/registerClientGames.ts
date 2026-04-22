"use client";

import { registerClientModule } from "@bgo/sdk-client";
import { ticTacToeClientModule } from "@bgo/games-tictactoe/client";
import { connectFourClientModule } from "@bgo/games-connectfour/client";
import { codenamesClientModule } from "@bgo/games-codenames/client";
import { spyfallClientModule } from "@bgo/games-spyfall/client";
import { reversiClientModule } from "@bgo/games-reversi/client";
import { checkersClientModule } from "@bgo/games-checkers/client";
import { gomokuClientModule } from "@bgo/games-gomoku/client";
import { dotsAndBoxesClientModule } from "@bgo/games-dotsandboxes/client";
import { battleshipClientModule } from "@bgo/games-battleship/client";
import { mastermindClientModule } from "@bgo/games-mastermind/client";
import { nimClientModule } from "@bgo/games-nim/client";
import { rpsClientModule } from "@bgo/games-rps/client";
import { memoryClientModule } from "@bgo/games-memory/client";
import { heartsClientModule } from "@bgo/games-hearts/client";
import { mancalaClientModule } from "@bgo/games-mancala/client";
import { liarsDiceClientModule } from "@bgo/games-liarsdice/client";
import { yahtzeeClientModule } from "@bgo/games-yahtzee/client";
import { avalonClientModule } from "@bgo/games-avalon/client";

let registered = false;

/** Idempotent — safe to call from any client entry point. */
export function registerAllClientGames(): void {
  if (registered) return;
  registerClientModule(ticTacToeClientModule);
  registerClientModule(connectFourClientModule);
  registerClientModule(codenamesClientModule);
  registerClientModule(spyfallClientModule);
  registerClientModule(reversiClientModule);
  registerClientModule(checkersClientModule);
  registerClientModule(gomokuClientModule);
  registerClientModule(dotsAndBoxesClientModule);
  registerClientModule(battleshipClientModule);
  registerClientModule(mastermindClientModule);
  registerClientModule(nimClientModule);
  registerClientModule(rpsClientModule);
  registerClientModule(memoryClientModule);
  registerClientModule(heartsClientModule);
  registerClientModule(mancalaClientModule);
  registerClientModule(liarsDiceClientModule);
  registerClientModule(yahtzeeClientModule);
  registerClientModule(avalonClientModule);
  registered = true;
}
