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

## Tailwind CSS and daisyUI

This project uses Tailwind CSS with the daisyUI component library (v5.0.0) for styling and UI components. All components use Tailwind/daisyUI utility classes with a focus on grid and flexbox layouts.

### Key Components Using daisyUI

- **Layout Components**

  - Root layout with theme support (`src/app/layout.tsx`)
  - All page layouts (Home, Game, Lobby)

- **UI Components**
  - Cards for panel layouts
  - Buttons with various styles (primary, outline, etc.)
  - Form controls (inputs, selects)
  - Alerts for error and status messages
  - Badges for status indicators
  - Loading spinners
  - Modals and dialogs

### Component Usage Examples

#### Cards

```jsx
<div className="card bg-base-100 shadow-md">
  <div className="card-body">
    <h2 className="card-title">Card Title</h2>
    <p>Card content goes here</p>
    <div className="card-actions justify-end">
      <button className="btn btn-primary">Action</button>
    </div>
  </div>
</div>
```

#### Form Controls

```jsx
<div className="form-control w-full">
  <label className="label">
    <span className="label-text">Label Text</span>
  </label>
  <input type="text" className="input input-bordered input-primary" />
</div>
```

#### Alerts

```jsx
<div className="alert alert-error">
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className="stroke-current shrink-0 h-6 w-6"
    fill="none"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
  <span>Error message</span>
</div>
```

### Layout Guidelines

We still follow grid and flexbox layout patterns with Tailwind:

#### Flexbox with daisyUI

```jsx
// Basic flex container
<div className="flex items-center justify-between">...</div>

// Card with centered content
<div className="card items-center">...</div>
```

#### Grid Layouts with Tailwind

```jsx
// Basic responsive grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">...</div>
```

### Theme Configuration

The project uses daisyUI theming with a custom light theme defined in `tailwind.config.js`. The theme colors match our brand palette:

- Primary: `#0070f3` (blue)
- Secondary: `#666666` (gray)
- Accent: `#37cdbe` (teal)
- Base colors for backgrounds and content

You can switch themes by setting the `data-theme` attribute on the `<html>` element:

```jsx
<html lang="en" data-theme="light">
```

## License

ISC
