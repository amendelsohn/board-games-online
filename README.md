# Board Games Online

A modern web application for playing board games online with friends.

## Description

Board Games Online is a full-stack web application that allows users to play various board games in real-time. The project is structured as a monorepo containing both frontend and backend code.

## Quickstart Guide

### Prerequisites

- Node.js (v20 or higher)
- pnpm (v8 or higher)

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/board-games-online.git
   cd board-games-online
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

### Development

Run shared packages, server, and web concurrently:

```bash
pnpm dev
```

Or run them individually:

```bash
pnpm dev:shared    # @bgo/sdk + @bgo/contracts + @bgo/sdk-client (watch mode)
pnpm dev:server    # @bgo/server (NestJS, port 8080)
pnpm dev:web       # @bgo/web (Next.js, port 3000)
```

### Building for Production

```bash
pnpm build         # build:shared + server + web
```

### Testing

```bash
pnpm test          # all package unit tests
pnpm test:e2e      # Playwright end-to-end suite
```

## Deploying

The repo ships Dockerfiles for `@bgo/server` and `@bgo/web` plus a
top-level `docker-compose.yml`. From a clean checkout:

```bash
docker compose up --build
# web  → http://localhost:3000
# server → http://localhost:8080
```

That's the five-minute path to a running app — clone, `docker compose up --build`,
open the browser.

### Environment variables

| Service  | Variable              | Purpose                                            | Default                  |
| -------- | --------------------- | -------------------------------------------------- | ------------------------ |
| `server` | `PORT`                | Listen port                                        | `8080`                   |
| `server` | `WEB_ORIGIN`          | Allowed CORS origin (browser-facing URL)           | `http://localhost:3000`  |
| `web`    | `PORT`                | Listen port                                        | `3000`                   |
| `web`    | `NEXT_PUBLIC_API_URL` | HTTP API URL the **browser** uses (build-arg too)  | `http://localhost:8080`  |

`NEXT_PUBLIC_API_URL` is baked into the client JS bundle at web-build
time (Next.js public env semantics), so it must be set as a `--build-arg`
when building `bgo-web`, not only at runtime. `docker-compose.yml` does
that automatically. The matching WebSocket URL is derived inside
`apiClient.ts` — `http://` becomes `ws://`, `https://` becomes `wss://`.

### Exposed ports

- `web` — `3000` (HTTP)
- `server` — `8080` (HTTP + Socket.IO WebSocket on the same port)
- `redis` — `6379` (stub; see below)

### Redis

`docker-compose.yml` includes a `redis:7-alpine` service provisioned for
the planned state-store migration. It is **not currently wired up** —
match state today lives in-process on the server. Safe to remove the
service for local tinkering; leave it in place for forward compatibility.

### Production notes

- Behind a reverse proxy / HTTPS terminator, set `NEXT_PUBLIC_API_URL`
  to the public HTTPS URL (e.g. `https://api.example.com`) and
  `WEB_ORIGIN` to the public web origin. CORS is credentialed, so the
  origin list must be exact — no wildcards.
- Both app images run as an unprivileged user (`node`) and declare a
  `HEALTHCHECK` (`GET /games` for the server, `GET /` for the web).
- Build context for both Dockerfiles is the monorepo root so the
  workspace's shared packages (`@bgo/sdk`, `@bgo/sdk-client`,
  `@bgo/contracts`, `@bgo/games-*`) resolve. Use
  `docker build -f packages/server/Dockerfile -t bgo-server .` and
  `docker build -f packages/web/Dockerfile -t bgo-web --build-arg NEXT_PUBLIC_API_URL=... .`.

## Project Structure

```
packages/
├── web/                # Next.js 15 frontend (@bgo/web)
├── server/             # NestJS backend with WebSocket gateway (@bgo/server)
├── sdk/                # Server-side game-module SDK (@bgo/sdk)
├── sdk-client/         # Client-side game-module SDK (@bgo/sdk-client)
├── contracts/          # Shared zod schemas / API contracts (@bgo/contracts)
└── games-*/            # One package per game (tic-tac-toe, hearts, hanabi, ...)
design/                 # Design assets and mockups
```

Each game lives in its own `packages/games-<name>/` package and registers itself with the server and the web client. See `AGENT_BRIEF.md` and `architecture-analysis.md` for the module contract.

## Tech Stack

### Frontend (`packages/web`)

- **Next.js 15** + **React 19** + **TypeScript**
- **TailwindCSS** + **DaisyUI**
- **socket.io-client** for real-time match updates

### Backend (`packages/server`)

- **NestJS** with **socket.io** gateway for real-time games
- In-memory match/state store (Redis-ready for the next phase)
- **Express** + **WebSockets**
