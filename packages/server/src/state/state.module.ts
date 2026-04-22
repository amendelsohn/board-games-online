import { Global, Module } from '@nestjs/common';
import { InMemoryStateStore } from './in-memory-state-store.service';
import { LobbyStore } from './lobby-store.service';

@Global()
@Module({
  providers: [
    LobbyStore,
    {
      provide: 'StateStore',
      useClass: InMemoryStateStore,
    },
    // Also expose the concrete class so modules that need setTimerFirer()
    // can inject it directly without extra indirection.
    InMemoryStateStore,
  ],
  exports: [LobbyStore, 'StateStore', InMemoryStateStore],
})
export class StateModule {}
