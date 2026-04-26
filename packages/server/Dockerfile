# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @bgo/server (NestJS).
#
# Context: monorepo root.  Build with:
#   docker build -f packages/server/Dockerfile -t bgo-server .
#
# Stage 1: builder — install every workspace dep, compile shared packages
# and every @bgo/games-* that the server registers, then build the server.
# Stage 2: runner — ship only dist/ + the minimum prod runtime.

# ---------- builder ----------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

WORKDIR /repo

# Copy workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/sdk/package.json            ./packages/sdk/package.json
COPY packages/sdk-client/package.json     ./packages/sdk-client/package.json
COPY packages/contracts/package.json      ./packages/contracts/package.json
COPY packages/server/package.json         ./packages/server/package.json
COPY packages/web/package.json            ./packages/web/package.json
# Game packages — one COPY per glob because pnpm needs every workspace
# manifest present at install time.
COPY packages/games-avalon/package.json          ./packages/games-avalon/package.json
COPY packages/games-battleship/package.json      ./packages/games-battleship/package.json
COPY packages/games-checkers/package.json        ./packages/games-checkers/package.json
COPY packages/games-chess/package.json           ./packages/games-chess/package.json
COPY packages/games-codenames/package.json       ./packages/games-codenames/package.json
COPY packages/games-connectfour/package.json     ./packages/games-connectfour/package.json
COPY packages/games-coup/package.json            ./packages/games-coup/package.json
COPY packages/games-dotsandboxes/package.json    ./packages/games-dotsandboxes/package.json
COPY packages/games-forsale/package.json         ./packages/games-forsale/package.json
COPY packages/games-gomoku/package.json          ./packages/games-gomoku/package.json
COPY packages/games-hanabi/package.json          ./packages/games-hanabi/package.json
COPY packages/games-hearts/package.json          ./packages/games-hearts/package.json
COPY packages/games-liarsdice/package.json       ./packages/games-liarsdice/package.json
COPY packages/games-loveletter/package.json      ./packages/games-loveletter/package.json
COPY packages/games-mancala/package.json         ./packages/games-mancala/package.json
COPY packages/games-mastermind/package.json      ./packages/games-mastermind/package.json
COPY packages/games-memory/package.json          ./packages/games-memory/package.json
COPY packages/games-nim/package.json             ./packages/games-nim/package.json
COPY packages/games-nothanks/package.json        ./packages/games-nothanks/package.json
COPY packages/games-pentago/package.json         ./packages/games-pentago/package.json
COPY packages/games-quoridor/package.json        ./packages/games-quoridor/package.json
COPY packages/games-reversi/package.json         ./packages/games-reversi/package.json
COPY packages/games-rps/package.json             ./packages/games-rps/package.json
COPY packages/games-skull/package.json           ./packages/games-skull/package.json
COPY packages/games-splendor/package.json        ./packages/games-splendor/package.json
COPY packages/games-spyfall/package.json         ./packages/games-spyfall/package.json
COPY packages/games-sushigo/package.json         ./packages/games-sushigo/package.json
COPY packages/games-tictactoe/package.json       ./packages/games-tictactoe/package.json
COPY packages/games-yahtzee/package.json         ./packages/games-yahtzee/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Now bring in the source tree.
COPY packages/sdk         ./packages/sdk
COPY packages/sdk-client  ./packages/sdk-client
COPY packages/contracts   ./packages/contracts
COPY packages/server      ./packages/server
COPY packages/games-avalon          ./packages/games-avalon
COPY packages/games-battleship      ./packages/games-battleship
COPY packages/games-checkers        ./packages/games-checkers
COPY packages/games-chess           ./packages/games-chess
COPY packages/games-codenames       ./packages/games-codenames
COPY packages/games-connectfour     ./packages/games-connectfour
COPY packages/games-coup            ./packages/games-coup
COPY packages/games-dotsandboxes    ./packages/games-dotsandboxes
COPY packages/games-forsale         ./packages/games-forsale
COPY packages/games-gomoku          ./packages/games-gomoku
COPY packages/games-hanabi          ./packages/games-hanabi
COPY packages/games-hearts          ./packages/games-hearts
COPY packages/games-liarsdice       ./packages/games-liarsdice
COPY packages/games-loveletter      ./packages/games-loveletter
COPY packages/games-mancala         ./packages/games-mancala
COPY packages/games-mastermind      ./packages/games-mastermind
COPY packages/games-memory          ./packages/games-memory
COPY packages/games-nim             ./packages/games-nim
COPY packages/games-nothanks        ./packages/games-nothanks
COPY packages/games-pentago         ./packages/games-pentago
COPY packages/games-quoridor        ./packages/games-quoridor
COPY packages/games-reversi         ./packages/games-reversi
COPY packages/games-rps             ./packages/games-rps
COPY packages/games-skull           ./packages/games-skull
COPY packages/games-splendor        ./packages/games-splendor
COPY packages/games-spyfall         ./packages/games-spyfall
COPY packages/games-sushigo         ./packages/games-sushigo
COPY packages/games-tictactoe       ./packages/games-tictactoe
COPY packages/games-yahtzee         ./packages/games-yahtzee

# Build shared packages, every game package, then the server itself.
RUN pnpm build:shared \
 && pnpm --filter "@bgo/games-*" build \
 && pnpm --filter @bgo/server build

# Produce a pruned prod-only deploy bundle for the runner stage.
# pnpm deploy only copies files declared in "files"/exports; the compiled
# server output lives at dist/ so we layer it back in explicitly afterwards.
RUN pnpm --filter @bgo/server --prod deploy /out \
 && cp -r packages/server/dist /out/dist

# ---------- runner ----------
FROM node:20-alpine AS runner

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /app

# Curl for HEALTHCHECK; tini-style signal handling via --init at runtime.
RUN apk add --no-cache curl

# Copy pruned production bundle (dist + node_modules).
COPY --from=builder --chown=node:node /out /app

USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-8080}/games" >/dev/null || exit 1

CMD ["node", "dist/main.js"]
