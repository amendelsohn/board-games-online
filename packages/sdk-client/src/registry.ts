import type { ClientGameModule } from "./types";

/**
 * Small registry the web app populates at startup. `@bgo/web` imports every
 * game package's client module and calls `registerClientModule(mod)`. Match
 * screen does `getClientModule(type)` to look up the right Board component.
 */
class ClientGameRegistry {
  private readonly modules = new Map<string, ClientGameModule<any, any, any>>();

  register<V, M, Cfg>(m: ClientGameModule<V, M, Cfg>): void {
    this.modules.set(m.type, m as ClientGameModule<any, any, any>);
  }

  get(type: string): ClientGameModule<any, any, any> | undefined {
    return this.modules.get(type);
  }

  all(): ReadonlyArray<ClientGameModule<any, any, any>> {
    return Array.from(this.modules.values());
  }
}

export const clientGameRegistry = new ClientGameRegistry();

export function registerClientModule<V, M, Cfg>(
  m: ClientGameModule<V, M, Cfg>,
): void {
  clientGameRegistry.register(m);
}

export function getClientModule(
  type: string,
): ClientGameModule<any, any, any> | undefined {
  return clientGameRegistry.get(type);
}
