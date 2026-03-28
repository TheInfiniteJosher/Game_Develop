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

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

### `artifacts/game-ide` (`@workspace/game-ide`)

React + Vite frontend for the AI Game Dev IDE.

- Entry: `src/main.tsx`
- Pages: `src/pages/Dashboard.tsx`, `src/pages/Ide.tsx`
- IDE components: `src/components/ide/` — FileExplorer, CodeEditor (Monaco), PreviewPanel, AiChatPanel, ChangesPanel
- Hooks: `src/hooks/use-api.ts` (React Query wrappers with cache invalidation), `src/hooks/use-ide.ts` (IDE context)
- Dark IDE theme: `src/index.css` (CSS variables for charcoal backgrounds, blue accent)
- Vite proxy: `/api/*` and `/preview/*` are proxied to the API server (port 8080 by default, configurable via `API_PORT` env var)

### `lib/replit-auth-web` (`@workspace/replit-auth-web`)

Browser auth helper library. Exports `useAuth()` React hook that:
- Fetches `/api/auth/user` (with credentials) to resolve the current session
- `login()` navigates to `/api/login?returnTo=<BASE_URL>`
- `logout()` navigates to `/api/logout`

## Auth Architecture

- **OIDC provider**: Replit (configured via `REPLIT_DOMAINS`, `REPLIT_DEPLOYMENT`, `SESSION_SECRET` env vars)
- **Sessions**: Stored in PostgreSQL `sessions` table (via `lib/auth.ts` / `createSession` / `getSession`)
- **Users**: Stored in PostgreSQL `users` table; upserted on OIDC callback
- **Middleware**: `authMiddleware` (in `middlewares/authMiddleware.ts`) runs on every request, populates `req.user` + `req.isAuthenticated()`
- **Auth routes** (mounted on authRouter): `GET /api/auth/user`, `GET /api/login`, `GET /api/callback`, `GET /api/logout`, `POST /api/mobile-auth/token-exchange`, `POST /api/mobile-auth/logout`
- **Project isolation**: Projects are scoped to `userId`; list/create require auth; anonymous users see an empty list and get 401 on create

## AI Game Dev IDE Features

- **Dashboard**: Requires sign-in (Replit OIDC). Shows auth gate with "Sign in" button when logged out. Authenticated users see their own projects with avatar + sign-out menu.
- Create/upload ZIP/manage projects; rename, duplicate, delete from dropdown menu
- **VS Code-style File Explorer**: Context menu (rename, delete, duplicate, new file, new folder), drag-and-drop upload
- **Monaco Code Editor**: Tabbed multi-file editing with syntax highlighting
- **Live Game Preview**: iframe serves from `/preview/:projectId/` with console.log injection (postMessage to parent)
- **Console Tab**: Captures logs/errors/warnings from the preview iframe in real time
- **AI Chat Panel**: SSE streaming chat (GPT via Replit OpenAI AI Integration), collapsible thoughts, parses file tags to apply code changes
- **Changes Panel**: History of AI-applied file changes with revert capability
- **File Storage**: `/tmp/game-ide-projects/{projectId}/files/` on disk
- **Demo Project**: "Demo: Phaser Platformer" created at startup for immediate exploration

## Key Routing

- Port 80 (via Replit proxy): game-ide Vite frontend at `/`
- Port 8080: API server (Express), mounted at `/api/` and `/preview/`
- The Vite dev server proxies `/api/*` and `/preview/*` to port 8080
