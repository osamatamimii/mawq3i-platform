# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Mawq3i Platform (`artifacts/mawq3i`)
- **Type**: React + Vite, preview path `/`
- **Purpose**: Premium Arabic-first SaaS ecommerce platform for Palestinian/Saudi merchants
- **Stack**: React, Vite, Tailwind CSS, Framer Motion, Recharts, Wouter, shadcn/ui
- **Theme**: Dark (#070A0D background, #52FF3F accent), Arabic RTL by default, EN toggle
- **Fonts**: Cairo (Arabic), Inter (English/numbers) from Google Fonts

#### Pages
- `/` or `/login` — Login page (AR/EN, RTL/LTR)
- `/dashboard` — Owner dashboard with stats cards, recent orders, top products
- `/products` — Products table with CRUD (edit modal, delete confirmation, visibility toggle)
- `/add-product` — Add product form with drag-and-drop image upload + mock AI image enhancement UI
- `/orders` — Orders table with inline status change dropdown
- `/analytics` — Count-up stats + Recharts bar chart (weekly sales) + line chart (monthly orders)
- `/settings` — Store settings form with save toast
- `/admin` — Admin panel: all stores table, add store modal, "enter as owner" action
- `/store` — Public storefront with hero, product grid, WhatsApp CTA

#### Key Files
- `src/context/AppContext.tsx` — Language (AR/EN), direction (RTL/LTR), currentUser (owner/admin)
- `src/data/mockData.ts` — Mock products, orders, stores (all Arabic, ILS/SAR currencies)
- `src/components/layout/` — Layout, Sidebar, Navbar
- `src/pages/` — All 9 pages

### API Server (`artifacts/api-server`)
- **Type**: Express 5 API, preview path `/api`
- **Purpose**: Shared backend server (currently only health endpoint)
