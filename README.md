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
