import type {
  CreatePlayerBody,
  CreatePlayerResponse,
  CreateTableBody,
  CreateTableResponse,
  ErrorResponse,
  FillTableBody,
  FillTableResponse,
  GetMeResponse,
  GetTableResponse,
  JoinTableResponse,
  KickBody,
  ListGamesResponse,
  RematchTableResponse,
  StartTableResponse,
  TableWire,
  UpdateConfigBody,
  UpdateMeBody,
} from "@bgo/contracts";

export const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

/**
 * Derive a WebSocket URL from the HTTP API URL so a single env var
 * (`NEXT_PUBLIC_API_URL`) drives both. socket.io is happy with either
 * scheme, but callers that use raw WebSocket need `ws://` / `wss://`.
 */
function toWsUrl(httpUrl: string): string {
  if (httpUrl.startsWith("https://")) return "wss://" + httpUrl.slice(8);
  if (httpUrl.startsWith("http://")) return "ws://" + httpUrl.slice(7);
  return httpUrl;
}

function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get("content-type") ?? "";
  return contentType.includes("application/json");
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    if (isJsonResponse(res)) {
      try {
        const body = (await res.json()) as ErrorResponse | { message?: string };
        if ("error" in body && body.error?.message) message = body.error.message;
        else if ("message" in body && body.message) message = body.message;
      } catch {
        // ignore parse error
      }
    }
    throw new Error(message);
  }
  if (!isJsonResponse(res)) {
    throw new Error(
      `Unexpected non-JSON response from ${path} (status ${res.status}). ` +
        `Check that NEXT_PUBLIC_API_URL points to the API server.`,
    );
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new Error(`Invalid JSON response from ${path}`);
  }
}

export const api = {
  listGames: () => request<ListGamesResponse>("/games"),

  createPlayer: (body: CreatePlayerBody) =>
    request<CreatePlayerResponse>("/players", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getMe: () => request<GetMeResponse>("/players/me"),

  updateMe: (body: UpdateMeBody) =>
    request<GetMeResponse>("/players/me", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  createTable: (body: CreateTableBody) =>
    request<CreateTableResponse>("/tables", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getTable: (id: string) => request<GetTableResponse>(`/tables/${id}`),

  joinTable: (joinCode: string) =>
    request<JoinTableResponse>(`/tables/${joinCode}/join`, {
      method: "POST",
    }),

  startTable: (id: string) =>
    request<StartTableResponse>(`/tables/${id}/start`, { method: "POST" }),

  rematchTable: (id: string) =>
    request<RematchTableResponse>(`/tables/${id}/rematch`, { method: "POST" }),

  updateConfig: (id: string, body: UpdateConfigBody) =>
    request<GetTableResponse>(`/tables/${id}/config`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  kickPlayer: (id: string, body: KickBody) =>
    request<GetTableResponse>(`/tables/${id}/kick`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  leaveTable: (id: string) =>
    request<{ ok: true }>(`/tables/${id}/leave`, { method: "POST" }),

  /**
   * Dev-only: fill a table with fake "Debug N" players so one browser can
   * play-test a multi-seat game. 404s against production servers.
   */
  fillDevTable: (id: string, body: FillTableBody = {}) =>
    request<FillTableResponse>(`/dev/tables/${id}/fill`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export const BASE_WS_URL = toWsUrl(BASE_URL);

export type { TableWire };
