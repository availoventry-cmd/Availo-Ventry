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

### `artifacts/ventry` (`@workspace/ventry`)

React + Vite frontend for Availo Ventry. Served at previewPath `/`.

- Built with React, TailwindCSS (v4 via @tailwindcss/vite), shadcn/ui components, wouter router, React Query
- Uses `@workspace/api-client-react` generated hooks to call the API server
- Auth: session cookie via `useAuth()` hook in `src/hooks/use-auth.tsx`
- Pages: Login, Super Admin Dashboard, Portal Dashboard (org admin/vm), Visit Requests, Receptionist Console, Public Booking
- Layout: `AppLayout` with role-aware sidebar navigation
- Entry at `src/main.tsx`, app routing in `src/App.tsx`
- All API calls go to relative `/api/...` paths — platform routes these to port 8080

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

## Availo Ventry — Application Details

Availo Ventry is a full-stack smart visitor management platform for government entities, enterprises, and SMBs.

### Features
- **6 user roles**: super_admin, org_admin, visitor_manager, receptionist, host_employee, external visitor
- **Two visitor flows**: host-initiated pre-registered with QR codes, and walk-in self-service with approval queue
- **Real-time notifications** (in-app)
- **Bilingual support**: Arabic RTL / English LTR (planned)
- Session-cookie auth using `express-session`; passwords hashed with SHA-256 + random salt
- **Dynamic Role & Permission System**: database-driven granular permissions replacing hardcoded role checks

### Dynamic Role & Permission System

**DB Tables**: `roles`, `role_permissions` (in `lib/db/src/schema/`). `users.roleId` and `invitations.roleId` added.

**Permissions** (`lib/db/src/permissions.ts`): 24 permissions across visit_requests, visitors, blacklist, users, branches, settings, reports, audit_logs, dashboard, roles, notifications. `ALL_PERMISSIONS` constant and `DEFAULT_ROLE_PERMISSIONS` per base role.

**Backend** (`artifacts/api-server/src/lib/auth.ts`):
- `loadPermissions(role, roleId)` — returns ALL permissions for super_admin/org_admin; loads from DB for others
- `requirePermission(...perms)` middleware — checks user permissions on every protected route
- `requireAuth` now attaches `permissions[]` to `req.user`
- All auth responses include `permissions[]` array

**API Route**: `GET|POST|PUT|DELETE /api/organizations/:orgId/roles` — full CRUD for custom roles

**Seeding**: `pnpm --filter @workspace/scripts run seed-roles` — creates default roles (visitor_manager, receptionist, host_employee) for all existing orgs. New orgs auto-get default roles on creation.

**Frontend** (`artifacts/ventry/src/`):
- `useAuth()` hook exposes `hasPermission(perm)` and `hasAnyPermission(...perms)` helpers
- `AppLayout` nav is permission-aware for non-admin roles
- `ProtectedRoute` supports `requiredPermission` prop
- `/portal/roles` — Roles & Permissions management page (create/edit/delete custom roles, assign permissions)

### Demo Credentials (seeded)
| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@t2.sa | Admin@1234 |
| Org Admin | admin@moi.gov.sa | OrgAdmin@123 |
| Visitor Manager | vm@moi.gov.sa | Visitor@123 |
| Receptionist | reception@moi.gov.sa | Recept@123 |
| Host Employee | employee@moi.gov.sa | Host@1234 |

### API Routes (all under `/api`)
- `/auth` — login, logout, me, accept-invitation, change-password
- `/organizations` — CRUD for super_admin
- `/organizations/:orgId/branches` — branch management
- `/organizations/:orgId/users` — user management
- `/organizations/:orgId/invitations` — invitation system
- `/organizations/:orgId/visitors` — visitor records
- `/organizations/:orgId/visit-requests` — visit request CRUD, approve/reject, check-in/out
- `/organizations/:orgId/blacklist` — blacklist management
- `/organizations/:orgId/roles` — role & permission management (CRUD, permission assignment)
- `/organizations/:orgId/audit-logs` — audit trail
- `/organizations/:orgId/reports` — visitor traffic reports
- `/dashboard/super-admin` — platform dashboard
- `/dashboard/org/:orgId` — org dashboard
- `/dashboard/branch/:branchId` — branch dashboard
- `/dashboard/host` — host employee dashboard
- `/notifications` — user notifications
- `/public/orgs/:slug` — public org info + walk-in booking
