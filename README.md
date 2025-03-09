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
