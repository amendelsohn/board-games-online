# Board Games Online

A modern implementation of board games using Next.js, React, and TypeScript with a NestJS backend.

## Project Structure

This is a monorepo managed with pnpm workspaces containing:

- `board-games-next` - Frontend application built with Next.js
- `bg-server` - Backend API built with NestJS

## Features

- Modern React with functional components and hooks
- Next.js App Router for improved routing and server components
- NestJS backend with REST API
- TypeScript for type safety throughout the stack
- pnpm workspaces for efficient package management
- CSS Modules for component-scoped styling
- Responsive design

## Games

- Tic Tac Toe

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- pnpm (recommended)

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/board-games-online.git
cd board-games-online
```

2. Install dependencies

```bash
pnpm install
```

3. Start the development servers

Start both frontend and backend in parallel:

```bash
pnpm dev
```

Or start them separately:

```bash
# Frontend
pnpm dev:frontend

# Backend
pnpm dev:backend
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

Create a `.env.local` file in the `board-games-next` directory with:

```
API_URL=http://localhost:8080
```

## Building for Production

```bash
pnpm build
```

## License

ISC
