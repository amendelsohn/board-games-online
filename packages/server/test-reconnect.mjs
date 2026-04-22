// Verifies that a client subscribing AFTER a match has already ended still
// receives both a terminal view_updated and a match_ended event, so late
// joiners / reconnecting clients can render the summary correctly.
import { io } from "socket.io-client";

const BASE = "http://localhost:8080";

async function http(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${path} -> ${res.status}: ${body}`);
  }
  return await res.json();
}

async function mkPlayer(name) {
  return await http(`/players`, {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}
async function auth(token, path, init = {}) {
  return await http(path, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: `Bearer ${token}` },
  });
}
function connect(player) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, {
      transports: ["websocket"],
      auth: { playerId: player.player.id, sessionToken: player.sessionToken },
    });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("ws timeout")), 5000);
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  console.log("1. two TTT players play a match to completion");
  const a = await mkPlayer("Alice");
  const b = await mkPlayer("Bob");
  const created = await auth(a.sessionToken, "/tables", {
    method: "POST",
    body: JSON.stringify({ gameType: "tic-tac-toe" }),
  });
  const table = created.table;
  await auth(b.sessionToken, `/tables/${table.joinCode}/join`, { method: "POST" });
  const start = await auth(a.sessionToken, `/tables/${table.id}/start`, {
    method: "POST",
  });
  const matchId = start.table.matchId;

  const aSock = await connect(a);
  const bSock = await connect(b);
  let current = null;
  const track = (p) => {
    current = p.currentActors?.[0] ?? null;
  };
  aSock.on("view_updated", track);
  bSock.on("view_updated", track);
  aSock.emit("subscribe_match", {
    matchId,
    playerId: a.player.id,
    sessionToken: a.sessionToken,
  });
  bSock.emit("subscribe_match", {
    matchId,
    playerId: b.player.id,
    sessionToken: b.sessionToken,
  });
  await sleep(300);

  const sendMove = (sock, move) =>
    new Promise((resolve, reject) => {
      sock.timeout(5000).emit("submit_move", { matchId, move }, (err, ack) => {
        if (err) return reject(err);
        if (!ack?.ok) return reject(new Error(ack?.reason ?? "rejected"));
        resolve();
      });
    });

  const sockOf = (id) => (id === a.player.id ? aSock : bSock);
  // X wins top row. Whoever is current goes first at every step.
  const moves = [0, 3, 1, 4, 2];
  for (const cellIndex of moves) {
    if (!current) throw new Error("no current player from view");
    await sendMove(sockOf(current), { kind: "place", cellIndex });
    await sleep(80);
  }

  aSock.close();
  bSock.close();
  console.log("   ✓ TTT match ended; original sockets closed");

  console.log("2. reconnect Alice to the finished match");
  const aSock2 = await connect(a);
  const received = { view: null, ended: null };
  aSock2.on("view_updated", (p) => {
    received.view = p;
  });
  aSock2.on("match_ended", (p) => {
    received.ended = p;
  });
  aSock2.emit("subscribe_match", {
    matchId,
    playerId: a.player.id,
    sessionToken: a.sessionToken,
  });
  await sleep(500);

  if (!received.view) throw new Error("no view_updated after re-subscribe");
  if (!received.view.isTerminal) {
    throw new Error("re-subscribe view was not terminal");
  }
  if (!received.ended) {
    throw new Error(
      "no match_ended delivered on re-subscribe to finished match",
    );
  }
  if (!received.ended.outcome) {
    throw new Error("match_ended missing outcome");
  }
  console.log("   ✓ terminal view_updated AND match_ended both delivered");

  aSock2.close();
  console.log("\nRECONNECT E2E OK");
}

run().catch((err) => {
  console.error("RECONNECT E2E FAILED:", err);
  process.exit(1);
});
