import type { GamesRegistry } from './games-registry.service';

/**
 * Registers every installed game module with the registry. Phase 3+ will add
 * imports like `import { serverModule as ticTacToe } from '@bgo/games-tictactoe'`
 * and call `registry.register(ticTacToe)`. Today this is a no-op stub so the
 * server boots with an empty games list (useful for framework-only smoke tests).
 */
export function registerAllGames(_registry: GamesRegistry): void {
  // intentionally empty — games arrive in Phase 3
}
