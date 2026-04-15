# Sato Frontend

React 19 + Vite dashboard for the Stato business management system.

## Tech Stack

- **Framework:** React 19 + Vite 8
- **Routing:** React Router 7
- **Styling:** Tailwind CSS 4 + Manrope font
- **Components:** Radix UI (shadcn/ui style)
- **Charts:** Recharts
- **State:** Zustand
- **Language:** TypeScript

## Prerequisites

- Node.js 20+
- pnpm 10+
- Sato Backend running on port 3001

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start the dev server

```bash
pnpm dev
```

The app will be running at **http://localhost:5173**.

### 3. Login

Open the app and use any of the demo accounts from the backend:

| Email | Password | Role |
|-------|----------|------|
| owner@stato.app | owner123 | owner |
| finance@stato.app | finance123 | finance_admin |
| ops@stato.app | ops123 | ops_manager |
| client@stato.app | client123 | client |
| readonly@stato.app | readonly123 | readonly |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server with HMR |
| `pnpm build` | Type-check and build for production |
| `pnpm preview` | Preview production build locally |

## Pages

| Route | Page | Access |
|-------|------|--------|
| `/login` | Login | Public |
| `/` | Dashboard | Authenticated |
| `/settings` | Settings | owner, finance_admin, ops_manager |
| `/*` | 404 Not Found | Public |

## Project Structure

```
src/
  components/
    dashboard/   # Dashboard-specific widgets
    layouts/     # Dashboard layout, header, sidebar
    providers/   # Auth context provider
    shared/      # Logo, protected route, skeletons
    ui/          # Reusable UI components (button, card, dialog, etc.)
  lib/           # API client, utility functions
  pages/         # Route pages (login, dashboard, settings, 404)
  stores/        # Zustand state stores
  types/         # Shared TypeScript types
  index.css      # Tailwind config and animations
  main.tsx       # App entrypoint
  App.tsx        # Router and provider setup
```
