#!/usr/bin/env node
// Picks a free port for the API server, then launches the dev stack with
// matching PORT / NEXT_PUBLIC_API_URL so `pnpm dev` works even when the
// preferred port (8080) is occupied by another process.

import { createServer } from "node:net";
import { spawn } from "node:child_process";

const PREFERRED_PORT = Number(process.env.PORT ?? 8080);

function checkPort(port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.unref();
    srv.once("error", () => resolve(false));
    srv.listen(port, () => srv.close(() => resolve(true)));
  });
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.once("error", reject);
    srv.listen(0, () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const port = (await checkPort(PREFERRED_PORT))
  ? PREFERRED_PORT
  : await findFreePort();

if (port === PREFERRED_PORT) {
  console.log(`[dev] using port ${port}`);
} else {
  console.log(
    `[dev] port ${PREFERRED_PORT} busy, falling back to free port ${port}`,
  );
}

// Deliberately do NOT propagate PORT to the parent env: Next.js also honors
// PORT, so leaking it into the web child would make Next.js bind the API
// port and then Nest would collide on it. PORT is injected inline only on
// the server command below.
const env = {
  ...process.env,
  NEXT_PUBLIC_API_URL:
    process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${port}`,
};
delete env.PORT;

const child = spawn(
  "pnpm",
  [
    "exec",
    "concurrently",
    "-n",
    "shared,server,web",
    "-c",
    "cyan,blue,magenta",
    "pnpm dev:shared",
    `PORT=${port} pnpm dev:server`,
    "pnpm dev:web",
  ],
  { stdio: "inherit", env },
);

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => child.kill(sig));
}
