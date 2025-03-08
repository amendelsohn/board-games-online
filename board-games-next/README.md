# Board Games Online

A modern implementation of board games using Next.js, React, and TypeScript.

## Features

- Modern React with functional components and hooks
- Next.js App Router for improved routing and server components
- TypeScript for type safety
- CSS Modules for component-scoped styling
- API routes to connect with the backend server
- Responsive design

## Games

- Tic Tac Toe

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- pnpm (recommended) or npm

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/board-games-online.git
cd board-games-online/board-games-next
```

2. Install dependencies

```bash
pnpm install
```

3. Start the development server

```bash
pnpm dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```
API_URL=http://localhost:8080
```

## Building for Production

```bash
pnpm build
pnpm start
```

## Backend Server

This project requires the backend server to be running. The backend server is a NestJS application located in the `bg-server` directory.

To start the backend server:

```bash
cd ../bg-server
npm install
npm run start:dev
```

## License

ISC
