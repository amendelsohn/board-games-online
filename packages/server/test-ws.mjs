// Quick Socket.IO smoke test. Run with: node packages/server/test-ws.mjs
import { io } from "socket.io-client";
import { randomUUID } from "node:crypto";

async function run() {
  const baseUrl = "http://localhost:8080";

  // Create two players via REST.
  const mkPlayer = async (name) => {
    const res = await fetch(`${baseUrl}/players`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(`create player: ${res.status}`);
    return await res.json();
  };

  const alice = await mkPlayer("Alice");
  const bob = await mkPlayer("Bob");
  console.log("created", alice.player.id, bob.player.id);

  // Since no games are registered yet, we just verify the WS handshake works.
  // Subscribing to a fake matchId should produce a validation error or "not found",
  // but the underlying WS transport should connect cleanly.
  const socket = io(baseUrl, {
    auth: {
      playerId: alice.player.id,
      sessionToken: alice.sessionToken,
    },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    socket.on("connect", () => {
      console.log("socket connected:", socket.id);
      resolve();
    });
    socket.on("connect_error", (err) => reject(err));
    setTimeout(() => reject(new Error("ws connect timeout")), 5000);
  });

  // Try a subscribe with a fake UUID — should ack with some error path.
  const fakeMatch = randomUUID();
  socket.emit(
    "subscribe_match",
    {
      matchId: fakeMatch,
      playerId: alice.player.id,
      sessionToken: alice.sessionToken,
    },
    (ack) => {
      console.log("subscribe_match ack:", ack);
    },
  );

  // No ack comes back because the handler returns void; it would emit view_updated
  // if a match existed. We tolerate this and exit after a short wait.
  await new Promise((r) => setTimeout(r, 500));
  socket.close();
  console.log("WS smoke test OK");
}

run().catch((err) => {
  console.error("WS smoke test FAILED:", err);
  process.exit(1);
});
