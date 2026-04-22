import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { GameModule, GameModuleMetadata } from '@bgo/sdk';
import { metadataOf } from '@bgo/sdk';

/**
 * Registry of installed game modules. Games are registered at startup by
 * GamesModule.onModuleInit(). Lookup by `type` string. The server is agnostic
 * about what games exist — it only knows this registry.
 */
@Injectable()
export class GamesRegistry {
  private readonly log = new Logger(GamesRegistry.name);
  private readonly modules = new Map<
    string,
    GameModule<unknown, unknown, unknown, unknown>
  >();

  register<S, M, Cfg, V>(m: GameModule<S, M, Cfg, V>): void {
    if (this.modules.has(m.type)) {
      throw new Error(`Game module already registered: ${m.type}`);
    }
    this.modules.set(
      m.type,
      m as unknown as GameModule<unknown, unknown, unknown, unknown>,
    );
    this.log.log(`Registered game module: ${m.type}`);
  }

  get(type: string): GameModule<unknown, unknown, unknown, unknown> {
    const m = this.modules.get(type);
    if (!m) throw new NotFoundException(`Unknown game type: ${type}`);
    return m;
  }

  tryGet(
    type: string,
  ): GameModule<unknown, unknown, unknown, unknown> | undefined {
    return this.modules.get(type);
  }

  list(): GameModuleMetadata[] {
    return Array.from(this.modules.values()).map((m) => metadataOf(m));
  }
}
