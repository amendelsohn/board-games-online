import type {
  CreatePlayerBody,
  CreatePlayerResponse,
  CreateTableBody,
  CreateTableResponse,
  ErrorResponse,
  GetMeResponse,
  GetTableResponse,
  JoinTableResponse,
  KickBody,
  ListGamesResponse,
  StartTableResponse,
  TableWire,
  UpdateConfigBody,
  UpdateMeBody,
} from "@bgo/contracts";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

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
    try {
      const body = (await res.json()) as ErrorResponse | { message?: string };
      if ("error" in body && body.error?.message) message = body.error.message;
      else if ("message" in body && body.message) message = body.message;
    } catch {
      // ignore parse error
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
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
};

export const BASE_WS_URL = BASE_URL;

export type { TableWire };
