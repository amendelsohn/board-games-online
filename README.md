# Board Games Online

A modern web application for playing board games online with friends.

## Description

Board Games Online is a full-stack web application that allows users to play various board games in real-time. The project is structured as a monorepo containing both frontend and backend code.

## Quickstart Guide

### Prerequisites

- Node.js (v16 or higher)
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

Run both frontend and backend concurrently:

```bash
pnpm dev
```

Or run them separately:

Frontend only:

```bash
pnpm dev:frontend
```

Backend only:

```bash
pnpm dev:backend
```

### Building for Production

Build both frontend and backend:

```bash
pnpm build
```

### Testing

Run tests for both frontend and backend:

```bash
pnpm test
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

- `board-games-next/` - Next.js frontend application
- `bg-server/` - NestJS backend server
- `design/` - Design assets and mockups
- `game-app/` - Game logic and shared components

## Tech Stack

### Frontend

- **Next.js 15** - React framework for building the user interface
- **React 19** - JavaScript library for building user interfaces
- **TypeScript** - Typed JavaScript for better developer experience
- **TailwindCSS** - Utility-first CSS framework
- **DaisyUI** - Component library for Tailwind CSS
- **React Query** - Data fetching and state management library

### Backend

- **NestJS** - Progressive Node.js framework for building server-side applications
- **TypeORM** - ORM for TypeScript and JavaScript
- **SQLite** - Lightweight disk-based database
- **Express** - Web framework for Node.js
- **WebSockets** - For real-time game updates
