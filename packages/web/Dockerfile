# syntax=docker/dockerfile:1.7
#
# Multi-stage build for @bgo/web (Next.js standalone).
#
# Context: monorepo root.  Build with:
#   docker build -f packages/web/Dockerfile -t bgo-web \
#     --build-arg NEXT_PUBLIC_API_URL=http://localhost:8080 .
#
# NEXT_PUBLIC_API_URL is baked into the client bundle at build time — the
# browser talks directly to the server, so this must be the URL the *user's
# browser* can reach (e.g. http://localhost:8080 in docker-compose, or
# https://api.example.com in production).

# ---------- builder ----------
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.3 --activate

WORKDIR /repo

# Workspace manifests first for layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/sdk/package.json            ./packages/sdk/package.json
COPY packages/sdk-client/package.json     ./packages/sdk-client/package.json
COPY packages/contracts/package.json      ./packages/contracts/package.json
COPY packages/server/package.json         ./packages/server/package.json
COPY packages/web/package.json            ./packages/web/package.json
COPY packages/games-avalon/package.json          ./packages/games-avalon/package.json
COPY packages/games-battleship/package.json      ./packages/games-battleship/package.json
COPY packages/games-bloodclocktower/package.json ./packages/games-bloodclocktower/package.json
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
COPY packages/games-secrethitler/package.json    ./packages/games-secrethitler/package.json
COPY packages/games-skull/package.json           ./packages/games-skull/package.json
COPY packages/games-splendor/package.json        ./packages/games-splendor/package.json
COPY packages/games-spyfall/package.json         ./packages/games-spyfall/package.json
COPY packages/games-sushigo/package.json         ./packages/games-sushigo/package.json
COPY packages/games-tictactoe/package.json       ./packages/games-tictactoe/package.json
COPY packages/games-yahtzee/package.json         ./packages/games-yahtzee/package.json

RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Source.
COPY packages/sdk         ./packages/sdk
COPY packages/sdk-client  ./packages/sdk-client
COPY packages/contracts   ./packages/contracts
COPY packages/web         ./packages/web
COPY packages/games-avalon          ./packages/games-avalon
COPY packages/games-battleship      ./packages/games-battleship
COPY packages/games-bloodclocktower ./packages/games-bloodclocktower
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
COPY packages/games-secrethitler    ./packages/games-secrethitler
COPY packages/games-skull           ./packages/games-skull
COPY packages/games-splendor        ./packages/games-splendor
COPY packages/games-spyfall         ./packages/games-spyfall
COPY packages/games-sushigo         ./packages/games-sushigo
COPY packages/games-tictactoe       ./packages/games-tictactoe
COPY packages/games-yahtzee         ./packages/games-yahtzee

# Public API URL is baked into the browser bundle at build time.
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build shared packages, every game package (transpilePackages still needs
# their dist/ for resolution), then compile Next.js in standalone mode.
RUN pnpm build:shared \
 && pnpm --filter "@bgo/games-*" build \
 && pnpm --filter @bgo/web build

# ---------- runner ----------
FROM node:20-alpine AS runner

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

RUN apk add --no-cache curl

# Next standalone ships a self-contained node_modules + server.js tree.
# With outputFileTracingRoot pointed at the workspace root, server.js
# lives at packages/web/server.js inside the standalone bundle.
COPY --from=builder --chown=node:node /repo/packages/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder --chown=node:node /repo/packages/web/public ./packages/web/public

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/" >/dev/null || exit 1

CMD ["node", "packages/web/server.js"]
