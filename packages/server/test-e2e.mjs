// End-to-end test: two players, tic-tac-toe game, plays to completion via WS.
// Run with server already up: node packages/server/test-e2e.mjs
import { io } from "socket.io-client";

const BASE = "http://localhost:8080";

async function http(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
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

function connect(player) {
  return new Promise((resolve, reject) => {
    const s = io(BASE, {
      transports: ["websocket"],
      auth: { playerId: player.player.id, sessionToken: player.sessionToken },
    });
    s.on("connect", () => resolve(s));
    s.on("connect_error", reject);
    setTimeout(() => reject(new Error("connect timeout")), 5000);
  });
}

async function run() {
  console.log("1. creating two players");
  const alice = await mkPlayer("Alice");
  const bob = await mkPlayer("Bob");

  console.log("2. games available:");
  const games = await http(`/games`);
  console.log("   " + games.games.map((g) => g.type).join(", "));

  console.log("3. Alice creates tic-tac-toe table");
  const created = await fetch(`${BASE}/tables`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${alice.sessionToken}`,
    },
    body: JSON.stringify({ gameType: "tic-tac-toe" }),
  });
  if (!created.ok) {
    console.error(await created.text());
    throw new Error("create table failed");
  }
  const { table: aliceTable } = await created.json();
  console.log("   code:", aliceTable.joinCode);

  console.log("4. Bob joins");
  const bobJoin = await fetch(
    `${BASE}/tables/${aliceTable.joinCode}/join`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bob.sessionToken}`,
      },
    },
  );
  if (!bobJoin.ok) throw new Error("join failed: " + (await bobJoin.text()));
  const { table: afterJoin } = await bobJoin.json();
  console.log("   players:", afterJoin.players.map((p) => p.name).join(", "));

  console.log("5. Alice starts the match");
  const startRes = await fetch(`${BASE}/tables/${aliceTable.id}/start`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${alice.sessionToken}`,
    },
  });
  if (!startRes.ok) throw new Error("start failed: " + (await startRes.text()));
  const { table: started } = await startRes.json();
  console.log("   matchId:", started.matchId);

  console.log("6. both players connect sockets and subscribe");
  const [aliceSock, bobSock] = await Promise.all([connect(alice), connect(bob)]);

  const viewsAlice = [];
  const viewsBob = [];
  aliceSock.on("view_updated", (p) => viewsAlice.push(p));
  bobSock.on("view_updated", (p) => viewsBob.push(p));

  aliceSock.emit("subscribe_match", {
    matchId: started.matchId,
    playerId: alice.player.id,
    sessionToken: alice.sessionToken,
  });
  bobSock.emit("subscribe_match", {
    matchId: started.matchId,
    playerId: bob.player.id,
    sessionToken: bob.sessionToken,
  });

  // Wait for first view on each.
  await new Promise((r) => setTimeout(r, 500));
  if (viewsAlice.length === 0 || viewsBob.length === 0) {
    throw new Error("did not receive view_updated after subscribe");
  }
  const first = viewsAlice.at(-1);
  console.log("   phase:", first.phase, "current:", first.currentActors);

  const sendMove = (sock, move) =>
    new Promise((resolve, reject) => {
      sock
        .timeout(5000)
        .emit("submit_move", { matchId: started.matchId, move }, (err, ack) => {
          if (err) return reject(err);
          if (!ack?.ok) return reject(new Error(ack?.reason ?? "rejected"));
          resolve();
        });
    });

  console.log("7. play a full game (X wins top row)");
  // Determine who is X.
  const initialView = viewsAlice.at(-1).view;
  const aliceSymbol = initialView.symbols[alice.player.id];
  const bobSymbol = initialView.symbols[bob.player.id];
  const xPlayer = aliceSymbol === "X" ? { sock: aliceSock, id: alice.player.id } : { sock: bobSock, id: bob.player.id };
  const oPlayer = aliceSymbol === "X" ? { sock: bobSock, id: bob.player.id } : { sock: aliceSock, id: alice.player.id };

  // X: 0, O: 3, X: 1, O: 4, X: 2 → X wins top row.
  await sendMove(xPlayer.sock, { kind: "place", cellIndex: 0 });
  await new Promise((r) => setTimeout(r, 100));
  await sendMove(oPlayer.sock, { kind: "place", cellIndex: 3 });
  await new Promise((r) => setTimeout(r, 100));
  await sendMove(xPlayer.sock, { kind: "place", cellIndex: 1 });
  await new Promise((r) => setTimeout(r, 100));
  await sendMove(oPlayer.sock, { kind: "place", cellIndex: 4 });
  await new Promise((r) => setTimeout(r, 100));
  await sendMove(xPlayer.sock, { kind: "place", cellIndex: 2 });
  await new Promise((r) => setTimeout(r, 200));

  const finalAlice = viewsAlice.at(-1);
  if (!finalAlice.isTerminal) throw new Error("game did not end");
  if (finalAlice.view.winner !== xPlayer.id) {
    throw new Error(
      `unexpected winner: got ${finalAlice.view.winner}, expected ${xPlayer.id}`,
    );
  }
  console.log("   X (", xPlayer.id, ") won ✓");

  aliceSock.close();
  bobSock.close();
  console.log("\nE2E OK");
}

run().catch((err) => {
  console.error("E2E FAILED:", err);
  process.exit(1);
});
