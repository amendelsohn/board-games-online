// End-to-end Spyfall test: 3 players, one is secretly the spy.
// Verifies:
//   - exactly one player's view shows isSpy=true with no location/role
//   - non-spies see the location + their own role
//   - the accusation + vote flow ends the game with the correct winner
//   - terminal state reveals the spy, location, and all roles to every client
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
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function run() {
  console.log("1. three players");
  const alice = await mkPlayer("Alice");
  const bob = await mkPlayer("Bob");
  const carol = await mkPlayer("Carol");
  const all = [alice, bob, carol];

  console.log("2. Alice creates spyfall table");
  const created = await auth(alice.sessionToken, "/tables", {
    method: "POST",
    body: JSON.stringify({ gameType: "spyfall" }),
  });
  const table = created.table;

  console.log("3. others join by code");
  for (const p of [bob, carol]) {
    await auth(p.sessionToken, `/tables/${table.joinCode}/join`, {
      method: "POST",
    });
  }

  console.log("4. host sets a short 2-minute round");
  await auth(alice.sessionToken, `/tables/${table.id}/config`, {
    method: "POST",
    body: JSON.stringify({ config: { roundSeconds: 120 } }),
  });

  console.log("5. start the match");
  const startRes = await auth(alice.sessionToken, `/tables/${table.id}/start`, {
    method: "POST",
  });
  const matchId = startRes.table.matchId;

  console.log("6. connect all sockets + subscribe");
  const socks = {};
  const views = {};
  const endOutcome = {};
  for (const p of all) {
    const s = await connect(p);
    s.on("view_updated", (payload) => {
      if (payload.matchId !== matchId) return;
      views[p.player.id] = payload.view;
    });
    s.on("match_ended", (payload) => {
      endOutcome[p.player.id] = payload.outcome;
    });
    s.emit("subscribe_match", {
      matchId,
      playerId: p.player.id,
      sessionToken: p.sessionToken,
    });
    socks[p.player.id] = s;
  }
  await sleep(400);

  // -- HIDDEN INFO CHECK --
  console.log("7. verifying hidden-info property");
  for (const p of all) {
    if (!views[p.player.id]) throw new Error(`no view for ${p.player.name}`);
  }
  const spyPlayers = all.filter((p) => views[p.player.id].viewer.isSpy);
  if (spyPlayers.length !== 1) {
    throw new Error(
      `Expected exactly 1 spy view, got ${spyPlayers.length}`,
    );
  }
  const spy = spyPlayers[0];
  const nonSpies = all.filter((p) => p.player.id !== spy.player.id);
  console.log(`   spy is: ${spy.player.name}`);

  // Spy: no location, no role
  const spyView = views[spy.player.id];
  if (spyView.viewer.location !== null) {
    throw new Error("spy saw the location");
  }
  if (spyView.viewer.role !== null) {
    throw new Error("spy saw a role");
  }
  if (!Array.isArray(spyView.locationPool) || spyView.locationPool.length < 10) {
    throw new Error("spy missing location pool");
  }

  // Non-spies: same location, their own role
  const nonSpyLocations = new Set(
    nonSpies.map((p) => views[p.player.id].viewer.location),
  );
  if (nonSpyLocations.size !== 1) {
    throw new Error(
      `non-spies saw different locations: ${[...nonSpyLocations].join(", ")}`,
    );
  }
  const [location] = [...nonSpyLocations];
  if (!location) throw new Error("non-spy location was null");
  for (const p of nonSpies) {
    const v = views[p.player.id];
    if (!v.viewer.role) {
      throw new Error(`non-spy ${p.player.name} has no role`);
    }
    if (v.viewer.isSpy) throw new Error("non-spy is marked as spy");
    if (v.location !== null) {
      throw new Error("non-spy leaked full location while in progress");
    }
    if (v.spyId !== null) {
      throw new Error("non-spy leaked spyId while in progress");
    }
    if (v.allRoles !== null) {
      throw new Error("non-spy leaked allRoles while in progress");
    }
  }
  console.log(
    `   ✓ 1 spy (location hidden), ${nonSpies.length} non-spies share location`,
  );

  // -- ACCUSE + VOTE FLOW --
  console.log("8. non-spy accuses the actual spy");
  const accuser = nonSpies[0];
  const secondVoter = nonSpies[1];

  const sendMove = (sock, move) =>
    new Promise((resolve, reject) => {
      sock
        .timeout(5000)
        .emit("submit_move", { matchId, move }, (err, ack) => {
          if (err) return reject(err);
          if (!ack?.ok) return reject(new Error(ack?.reason ?? "rejected"));
          resolve();
        });
    });

  await sendMove(socks[accuser.player.id], {
    kind: "accuse",
    target: spy.player.id,
  });
  await sleep(150);

  const afterAccuse = views[accuser.player.id];
  if (afterAccuse.phase !== "voting") {
    throw new Error(`phase after accuse is ${afterAccuse.phase}, expected voting`);
  }
  if (!afterAccuse.accusation || afterAccuse.accusation.target !== spy.player.id) {
    throw new Error("accusation missing or wrong target");
  }
  console.log("   ✓ phase → voting, accusation registered");

  console.log("9. other non-spy approves the accusation");
  await sendMove(socks[secondVoter.player.id], {
    kind: "vote",
    approve: true,
  });
  await sleep(300);

  // -- OUTCOME --
  const final = views[accuser.player.id];
  if (!final || final.phase !== "gameOver") {
    throw new Error("game did not end after approving accusation");
  }
  if (final.winner !== "nonSpies") {
    throw new Error(`expected nonSpies to win, got ${final.winner}`);
  }
  if (final.winReason !== "accusedSpy") {
    throw new Error(`expected winReason accusedSpy, got ${final.winReason}`);
  }
  console.log(`   ✓ non-spies won by accusedSpy`);

  // -- TERMINAL VIEW REVEALS --
  console.log("10. all players see full reveal on terminal");
  for (const p of all) {
    const v = views[p.player.id];
    if (v.phase !== "gameOver") {
      throw new Error(`${p.player.name} phase not gameOver`);
    }
    if (v.spyId !== spy.player.id) {
      throw new Error(`${p.player.name} did not see spy on terminal`);
    }
    if (v.location !== location) {
      throw new Error(`${p.player.name} did not see location on terminal`);
    }
    if (!v.allRoles) {
      throw new Error(`${p.player.name} missing allRoles on terminal`);
    }
    for (const np of nonSpies) {
      if (!v.allRoles[np.player.id]) {
        throw new Error(
          `${p.player.name} missing role for ${np.player.name} on terminal`,
        );
      }
    }
  }
  console.log("   ✓ spyId, location, and allRoles visible to everyone");

  console.log("11. match_ended delivered to all clients");
  await sleep(200);
  for (const p of all) {
    if (!endOutcome[p.player.id]) {
      throw new Error(`no match_ended for ${p.player.name}`);
    }
  }
  console.log("   ✓ match_ended delivered to all 3 clients");

  for (const s of Object.values(socks)) s.close();
  console.log("\nSPYFALL E2E OK");
}

run().catch((err) => {
  console.error("SPYFALL E2E FAILED:", err);
  process.exit(1);
});
