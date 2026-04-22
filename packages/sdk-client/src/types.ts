import type {
  GameEvent,
  Outcome,
  PhaseId,
  Player,
  PlayerId,
} from "@bgo/sdk";
import type { ComponentType } from "react";

export interface BoardProps<V, M> {
  view: V;
  phase: PhaseId;
  me: PlayerId;
  players: Player[];
  isMyTurn: boolean;
  sendMove: (move: M) => Promise<void>;
  onEvent: (listener: (e: GameEvent) => void) => () => void;
  latencyMs: number;
}

export interface LobbyPanelProps<Cfg> {
  config: Cfg;
  players: Player[];
  isHost: boolean;
  onChange: (next: Cfg) => void;
}

export interface SummaryProps<V> {
  view: V;
  outcome: Outcome;
}

export interface ClientGameModule<V = unknown, M = unknown, Cfg = unknown> {
  readonly type: string;
  readonly Board: ComponentType<BoardProps<V, M>>;
  readonly LobbyPanel?: ComponentType<LobbyPanelProps<Cfg>>;
  readonly Summary?: ComponentType<SummaryProps<V>>;
}
