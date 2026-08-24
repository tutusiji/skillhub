# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

SkillHub — an enterprise AI skill/plugin marketplace for private deployments. The repo contains **two independent apps** that share domain concepts but **no code**:

- **Frontend SPA** (`src/`) — React 19 + Vite + Tailwind v4. This is the primary demo surface.
- **NestJS backend** (`server/`) — an enterprise backend; both `.` and `server` are members of the pnpm workspace (`pnpm-workspace.yaml`).

The two are **partially wired**: the frontend boots read-only skills/users/rules from the backend and authenticates with backend JWT APIs, while most write operations still update local React state/localStorage only.

## Commands

### Frontend (repo root)
```bash
pnpm install          # installs root + server/ in one go (both are workspace members)
pnpm run dev          # Vite dev server on :7001
pnpm run build        # vite build
pnpm run lint         # tsc --noEmit (typecheck — the only "lint")
pnpm run preview      # preview the built bundle
```

### Backend (workspace member `server/`)
```bash
pnpm run server:dev      # NestJS watch mode on :3001 (--filter skillhub-server run start:dev)
pnpm run server:build    # nest build
pnpm run server:start    # node dist/main (start:prod)
# or cd server && pnpm run start:dev
```

There is **no test runner and no test suites** in either app.

## Architecture

### Frontend: React SPA with an offline-capable backend client
- Most application state lives in `App.tsx` (React `useState`), seeded from mock data in `src/mock/initialData.ts` and persisted to `localStorage` under `skillhub_*` keys (`skillhub_skills`, `skillhub_rules`, `skillhub_demands`, `skillhub_feedback`, `skillhub_deepseek`, `skillhub_all_users`, `skillhub_user`). On startup, `src/services/api.ts` attempts to replace skills/users/rules with backend data and keeps mock data as an offline fallback. Set `VITE_API_BASE_URL` to override the default `http://localhost:3001`.
- There is **no router** — the "pages" (Marketplace, SkillDemandMarket, PersonalCenter, AuditManagement, RuleManagement, AdminSettings) are views switched by state in `App.tsx` and rendered through `<Header>` tabs and modal components.
- Core entity types are in `src/types/index.ts` (`SkillItem`, `AuditRule`, `SkillDemand`, `UserAccount`, `DeepSeekConfig`, `FileTreeNode`, …). `ExpertDomain` → `src/data/expertDomains.ts` holds the domain taxonomy + badge styling.
- ZIP download / file-tree creation lives in `src/utils/zipHelper.ts`.
- **All backend calls go through `src/services/api.ts`** — `apiFetch` injects `Authorization: Bearer <skillhub_token>`, tracks online status, and normalizes errors; `mapApiSkill` / `mapApiUser` / `mapAuditRule` translate server entities into the frontend types. Two write patterns are used: `syncToBackend(task, label)` for fire-and-forget optimistic counters (likes/stars/downloads/points), and `await` + snapshot rollback + toast for authoritative mutations (approve/reject/delist/relist/delete, role changes, rule CRUD).
- `<Header backendOnline={...}>` renders a status dot: grey/pulsing while probing, green when the backend answered, amber for offline demo-data mode.

### Backend: NestJS enterprise service
- **Persistence** is TypeORM via `server/src/database/database.module.ts`: SQLite by default (DB file at `server/storage/skillhub.sqlite`), or PostgreSQL when `DB_TYPE=postgres` / `DATABASE_URL` is set. `synchronize: true` auto-creates tables. Entities: `UserEntity`, `SkillEntity`, `AuditRuleEntity`, `AuditReportEntity`.
- `server/src/main.ts` enables CORS, 50mb JSON body parsing, and `raw` body parsing for Git Smart HTTP content types. Listens on `PORT || 3001`.
- `server/src/modules/git-market/` — Git Smart HTTP marketplace endpoint:
  - `GET skillhub.git/info/refs` (also `market.git/...`) and `POST skillhub.git/git-upload-pack` **shell out to the system `git` binary** (`spawn('git', ['upload-pack', ...])`). This is how Claude Code's `/plugin marketplace add` / `/plugin install` pull from the repo.
  - The backing repo is a working tree at `server/storage/git-marketplace/`, initialized and committed via `isomorphic-git`, with the plugin index at `.claude-plugin/marketplace.json`. Regenerated on startup.
  - Also exposes `GET .claude-plugin/marketplace.json` and `GET api/v1/marketplace/manifest`.
- `server/src/modules/skills/` — skill CRUD + ZIP upload/file-tree extraction + install-command generation + publish-to-git (`SkillsService`), DB-backed.
- `server/src/modules/audit/` — rules and reports persisted in DB; the regex engine in `runDualEngineScan` reads enabled rules from the repository; seeding happens in `onModuleInit`.
- `server/src/modules/auth/` — real JWT + bcrypt auth: `POST api/v1/auth/register`, `POST api/v1/auth/login`, `GET api/v1/auth/users` (guard + guard usage). Seeds 3 preset accounts on first boot (e.g. `admin@skillhub.corp`, password `Password123!`). Legacy demo tokens `token-dev-admin` / `token-dev-user` still validate. Anonymous access allowed for `/api/v1/skills`, `/api/v1/auth/*`, `/skillhub.git`, `/market.git`, `/.claude-plugin`.

### The "dual-engine audit" exists twice, independently
The same concept is implemented separately in both apps, and the two do not share code:
- Frontend: `src/utils/auditRunner.ts` → `executeDualEngineAudit(skill, rules, onProgress, deepseekConfig)`
- Backend: `server/src/modules/audit/audit.service.ts` → `runDualEngineScan(payload)`

**Important: "Engine 2" (DeepSeek LLM) is not a real LLM call in either app.** In both, it is heuristic keyword matching (`String.includes(...)` against things like `'ignore previous'`, `'base64'`, permissions lists, `fetch(`+`process.env`). There is no network call to DeepSeek or any LLM; the frontend's `DeepSeekConfig` only supplies a display label (`modelName`) and is persisted but unused for inference. Don't assume an API key is needed or that enabling the "LLM engine" invokes a model.

## Conventions & gotchas

- **Types are duplicated** between `src/types/index.ts` (frontend) and server-side interfaces (`AuditRule`, `PluginManifestItem`, …). There is no shared package — keep them in sync manually when changing a domain type.
- **Business functions must have Chinese comments** — explicit project rule (README 开发规范). Follow existing comment style (`/** ... */` docblocks).
- **Frontend state persistence pattern**: lazy `useState(() => { const saved = localStorage.getItem('skillhub_X'); ... return INITIAL_X })` plus a `useEffect` that writes back on change. `ErrorBoundary` in `src/main.tsx` offers a "reset cache" that clears the `skillhub_*` keys and reloads.
- **`DISABLE_HMR=true`** env var disables Vite HMR and file watching — designed for AI Studio / agent-driven editing. `vite.config.ts` explicitly warns not to modify this behavior.
- `@/` import alias resolves to the repo root.
- **`server/storage/` is runtime data** (the SQLite DB + the git marketplace repo) and is gitignored. Both are regenerated/seeded automatically on server startup (`onModuleInit`), so don't commit or edit files there.
- The server depends on native builds (`sqlite3`, `pg`, `esbuild`) — `pnpm-workspace.yaml` lists them in `allowBuilds`.
- **What is backend-backed vs local-only.** Backend-backed: skills/users/rules bootstrap, JWT login/register/profile, skill upload, approve/reject/delist/relist/delete, like/star/download counters, audit-score writeback, user role + points, audit rule save/toggle/delete. Still local-only (`localStorage`): the whole skill-demand workflow, feedback submissions, and DeepSeek configuration. The app is React 19 + Vite (not Remix).
- **Slug handling lives server-side.** `SkillsService.resolveUniqueSlug` derives an ASCII kebab-case slug from `name` when `slug` is omitted, strips non-ASCII (Chinese names fall back to `skill-<base36>`), and appends `-2`, `-3`, … on collision — plugin directory names and `/plugin install` commands must stay ASCII. `createSkill` rejects a missing `name`/`description` with 400 instead of throwing 500.
- **Dev-server proxy**: `vite.config.ts` proxies `/api`, `/skillhub.git`, `/market.git`, and `/.claude-plugin` to `BACKEND_TARGET` (default `http://127.0.0.1:3001`) and sets `allowedHosts: true`, so a tunnelled origin serves frontend + backend same-origin. Vite falls through to :7002+ if :7001 is taken.
