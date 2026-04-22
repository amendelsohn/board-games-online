"use client";

import { api } from "./apiClient";
import type { PlayerWire } from "@bgo/contracts";

const SESSION_STORAGE_KEY = "bgo.sessionToken";
const NAME_STORAGE_KEY = "bgo.playerName";

export function getStoredSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

export function storeSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SESSION_STORAGE_KEY, token);
}

export function getStoredName(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(NAME_STORAGE_KEY);
}

export function storeName(name: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NAME_STORAGE_KEY, name);
}

export function clearPlayerSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.localStorage.removeItem(NAME_STORAGE_KEY);
}

/** Load or create a persistent player session. */
export async function ensurePlayer(defaultName?: string): Promise<{
  player: PlayerWire;
  sessionToken: string;
}> {
  try {
    const me = await api.getMe();
    const token = getStoredSessionToken();
    if (token) return { player: me.player, sessionToken: token };
  } catch {
    // no session or invalid — fall through and create
  }

  const name = defaultName ?? getStoredName() ?? randomName();
  const created = await api.createPlayer({ name });
  storeSessionToken(created.sessionToken);
  storeName(created.player.name);
  return { player: created.player, sessionToken: created.sessionToken };
}

function randomName(): string {
  const adjectives = ["Quick", "Clever", "Lucky", "Bold", "Wise", "Swift"];
  const nouns = ["Fox", "Hawk", "Otter", "Bear", "Lynx", "Dolphin"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const n = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 1000);
  return `${a}${n}${num}`;
}
