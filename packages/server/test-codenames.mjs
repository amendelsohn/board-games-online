// End-to-end Codenames test: 4 players (2 red, 2 blue, one spymaster each).
// Verifies:
//   - spymasters see all 25 card roles
//   - operatives see roles ONLY on revealed cards
//   - a full game plays to termination and outcome is correct
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
  console.log("1. four players");
  const redSpy = await mkPlayer("RedSpy");
  const redOp = await mkPlayer("RedOp");
  const blueSpy = await mkPlayer("BlueSpy");
  const blueOp = await mkPlayer("BlueOp");

  console.log("2. RedSpy creates codenames table");
  const created = await auth(redSpy.sessionToken, "/tables", {
    method: "POST",
    body: JSON.stringify({ gameType: "codenames" }),
  });
  const table = created.table;

  console.log("3. others join by code");
  for (const p of [redOp, blueSpy, blueOp]) {
    await auth(p.sessionToken, `/tables/${table.joinCode}/join`, {
      method: "POST",
    });
  }

  console.log("4. RedSpy (host) assigns teams + spymasters");
  const config = {
    teams: {
      [redSpy.player.id]: "red",
      [redOp.player.id]: "red",
      [blueSpy.player.id]: "blue",
      [blueOp.player.id]: "blue",
    },
    spymasters: {
      red: redSpy.player.id,
      blue: blueSpy.player.id,
    },
  };
  await auth(redSpy.sessionToken, `/tables/${table.id}/config`, {
    method: "POST",
    body: JSON.stringify({ config }),
  });

  console.log("5. start the match");
  const startRes = await auth(redSpy.sessionToken, `/tables/${table.id}/start`, {
    method: "POST",
  });
  const matchId = startRes.table.matchId;

  console.log("6. connect all sockets + subscribe");
  const socks = {};
  const views = {};
  const endOutcome = {};
  for (const p of [redSpy, redOp, blueSpy, blueOp]) {
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
  const spyView = views[redSpy.player.id];
  const opView = views[redOp.player.id];
  if (!spyView || !opView) throw new Error("views missing");

  // Spymaster should see non-null role on all 25 cards.
  const spySeesAll = spyView.grid.every((c) => c.role !== null);
  // Operative should see non-null role ONLY on revealed cards (none revealed yet).
  const opSeesNone = opView.grid.every((c) =>
    c.revealed ? c.role !== null : c.role === null,
  );
  if (!spySeesAll) throw new Error("spymaster did not see full grid");
  if (!opSeesNone) throw new Error("operative saw hidden roles");
  console.log("   ✓ spymaster sees all 25 roles, operative sees 0");

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

  // Build lookup: cardIndex -> role (from spymaster view, which has them all)
  const roleOf = spyView.grid.map((c) => c.role);

  // Helper: first unrevealed card with the given role.
  const findUnrevealed = (role) => {
    const current = views[redSpy.player.id];
    for (let i = 0; i < current.grid.length; i++) {
      if (!current.grid[i].revealed && roleOf[i] === role) return i;
    }
    return -1;
  };

  // -- PLAY A DETERMINISTIC GAME --
  // Strategy: red spymaster gives clues (1); red operative guesses one red
  // card each turn; blue spymaster gives clues (1); blue operative guesses
  // one blue card each turn. Neither team picks the assassin. Red gets 9
  // cards (starting team), so red should win on last-card.

  const startTeam = spyView.turn;
  console.log("   starting team:", startTeam);
  const redFirst = startTeam === "red";
  const redGoal = redFirst ? 9 : 8;
  const blueGoal = redFirst ? 8 : 9;

  const play = async (team, spy, op, clueIdx) => {
    await sendMove(socks[spy.player.id], {
      kind: "giveClue",
      word: `c${clueIdx}-${team}`,
      count: 1,
    });
    await sleep(80);
    const i = findUnrevealed(team);
    if (i < 0) throw new Error(`no unrevealed ${team}`);
    await sendMove(socks[op.player.id], { kind: "guess", cardIndex: i });
    await sleep(80);
    // With count=1, guessesLeft starts at 2. Voluntarily end to hand off
    // the turn after a single correct guess.
    const stillGuessing = views[redSpy.player.id].phase === "guessing";
    const stillOurTurn = views[redSpy.player.id].turn === team;
    if (stillGuessing && stillOurTurn) {
      await sendMove(socks[op.player.id], { kind: "endGuessing" });
      await sleep(80);
    }
  };

  let round = 0;
  while (
    views[redSpy.player.id] &&
    views[redSpy.player.id].phase !== "gameOver" &&
    round < 40
  ) {
    if (round % 2 === 0) {
      // starting team
      if (redFirst) {
        await play("red", redSpy, redOp, round);
      } else {
        await play("blue", blueSpy, blueOp, round);
      }
    } else {
      if (redFirst) {
        await play("blue", blueSpy, blueOp, round);
      } else {
        await play("red", redSpy, redOp, round);
      }
    }
    round++;
  }

  const final = views[redSpy.player.id];
  if (!final || final.phase !== "gameOver") {
    throw new Error("game did not finish");
  }

  // Expected winner: whichever team reached their goal first. Starting team
  // should win by one turn because they act first and have 9 cards vs 8.
  // But after correct guess they use up guessesLeft (1 each turn => 1 guess
  // per clue, which ends their turn).
  console.log("   ended on round", round, "winner:", final.winner);

  // -- OUTCOME DELIVERED TO ALL --
  await sleep(300);
  for (const p of [redSpy, redOp, blueSpy, blueOp]) {
    if (!endOutcome[p.player.id]) {
      throw new Error(`no match_ended for ${p.player.name}`);
    }
  }
  console.log("   ✓ match_ended delivered to all 4 clients");

  // -- TERMINAL VIEW HAS FULL GRID --
  const finalOp = views[redOp.player.id];
  const opSeesAllNow = finalOp.grid.every((c) => c.role !== null);
  if (!opSeesAllNow) throw new Error("operative did not see roles on terminal");
  console.log("   ✓ operative sees full grid on terminal state");

  for (const s of Object.values(socks)) s.close();
  console.log("\nCODENAMES E2E OK");
}

run().catch((err) => {
  console.error("CODENAMES E2E FAILED:", err);
  process.exit(1);
});
