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
- **Routing is path-based** (no router library). `src/App.tsx` maps paths to tabs: `/` market, `/demands`, `/personal`, `/audit`, `/rules`, `/settings`, `/feedback`, `/skill/:slugOrId` detail. All tab changes go through the single `navigate(tab, skill?)` helper which `pushState`s the path and updates state; browser back/forward is handled by a `popstate` listener (it only sets state, never pushes, to avoid loops). Old hash links (`/#tab=x`, `/#skill=x`) are migrated to paths once on startup via `replaceState`. Legacy `hashchange` listener was removed — do not reintroduce hash URLs. Both Vite dev (SPA appType default) and the production Nest static server (`main.ts` catch-all fallback) serve path routes without extra config.
- Most application state lives in `App.tsx` (React `useState`), seeded from the compile-time mock constants in `src/mock/initialData.ts` and **immediately replaced by backend data on startup** (`src/services/api.ts`). **Business data is never persisted to `localStorage`** — the database/backend is the single source of truth; the mock constants are only an offline demo fallback. The only `localStorage` keys in use are the auth session: `skillhub_token` (JWT, written by `LoginModal`/`api.ts`, read by `apiFetch`) and a vestigial `skillhub_user` cleanup. `sessionStorage` remembers the active tab and selected skill for refresh recovery. Set `VITE_API_BASE_URL` to override the default `http://localhost:3001`.
- There is **no router** — the "pages" (Marketplace, SkillDemandMarket, PersonalCenter, AuditManagement, RuleManagement, AdminSettings, FeedbackAdmin) are views switched by state in `App.tsx` and rendered through `<Header>` tabs and modal components.
- Core entity types are in `src/types/index.ts` (`SkillItem`, `AuditRule`, `SkillDemand`, `UserAccount`, `DeepSeekConfig`, `FileTreeNode`, …). `ExpertDomain` → `src/data/expertDomains.ts` holds the domain taxonomy + badge styling.
- ZIP download / file-tree creation lives in `src/utils/zipHelper.ts`.
- **All backend calls go through `src/services/api.ts`** — `apiFetch` injects `Authorization: Bearer <skillhub_token>`, tracks online status, and normalizes errors; `mapApiSkill` / `mapApiUser` / `mapAuditRule` translate server entities into the frontend types. Two write patterns are used: `syncToBackend(task, label)` for fire-and-forget optimistic counters (likes/stars/downloads/points), and `await` + snapshot rollback + toast for authoritative mutations (approve/reject/delist/relist/delete, role changes, rule CRUD).
- `<Header backendOnline={...}>` renders a status dot: grey/pulsing while probing, green when the backend answered, amber for offline demo-data mode.

### Backend: NestJS enterprise service
- **Persistence** is TypeORM via `server/src/database/database.module.ts`, **PostgreSQL only** (SQLite support was removed). Connection via `DB_*` env vars or `DATABASE_URL`; `synchronize: true` auto-creates tables. **Env files load by `APP_ENV`** (`dev`/`test`/`prod`): `ConfigModule` loads `.env` → `.env.local` → `.env.<APP_ENV>` (later wins). Commit only `server/.env`; per-environment PG addresses live in untracked `.env.test` / `.env.prod` (see deployment-guide §5.3). Entities: `UserEntity`, `SkillEntity`, `AuditRuleEntity`, `AuditReportEntity`, `SkillDemandEntity`, `LlmConfigEntity`, `FeedbackEntity`, `SkillCategoryEntity`, `ExpertDomainEntity`.
- **Never query a `uuid` primary key with an unvalidated external string.** `UserEntity`, `SkillDemandEntity` and `AuditReportEntity` use `@PrimaryGeneratedColumn('uuid')`; `SkillEntity`, `AuditRuleEntity` and `LlmConfigEntity` use plain varchar `@PrimaryColumn`. **a malformed id makes the PostgreSQL driver throw `QueryFailedError: invalid input syntax for type uuid`, which surfaces as a 500 where the caller expects 404**. Route all such lookups through `isUuid` / `findByUuid` in `server/src/common/db-id.util.ts` (`findByUuid` returns `null` for a malformed id so existing "not found" branches keep working). This bit seven endpoints after the Postgres switch: all five `demands/:id/*` routes, both `auth/users/:id/*` routes, and `GET /auth/me` with a legacy demo token. Regression group 9 guards it.
- `resolveFreshSession` resolves `/auth/me` by uuid lookup on `sub` only. Accounts deleted from the DB get `null` (no token-snapshot fallback — a stale token must not keep granting access). The legacy demo tokens `token-dev-admin` / `token-dev-user` were **removed as a security backdoor** (anyone could mint an admin session with them); regression group 9 asserts they now 401. JWT payload has no `points` and a stale `role`, so `/auth/me` re-reads the DB; `src/` has no reference to the legacy tokens.
- `server/src/main.ts` enables CORS, 50mb JSON body parsing, and `raw` body parsing for Git Smart HTTP content types. Listens on `PORT || 3001`.
- `server/src/modules/git-market/` — Git Smart HTTP marketplace endpoint:
  - `GET skillhub.git/info/refs` (also `market.git/...`) and `POST skillhub.git/git-upload-pack` **shell out to the system `git` binary** (`spawn('git', ['upload-pack', ...])`). This is how Claude Code's `/plugin marketplace add` / `/plugin install` pull from the repo.
  - The backing repo is a working tree at `server/storage/git-marketplace/`, initialized and committed via `isomorphic-git`, with the plugin index at `.claude-plugin/marketplace.json`. Regenerated on startup.
  - Also exposes `GET .claude-plugin/marketplace.json` and `GET api/v1/marketplace/manifest`.
- `server/src/modules/skill-categories/` — 技能分类标签管理: `GET /api/v1/skill-categories` is anonymous (marketplace tabs + upload form read it, `?all=1` includes disabled), create/update/delete require admin. Backed by the `skill_categories` table (seeded with 8 defaults); the marketplace tab bar and the upload form render categories from this endpoint with a hardcoded fallback when offline.
- **分类和专家组管理** lives at route `/manage` (`CategoryAndDomainView`, admin-only, reachable from the header user dropdown「分类和专家组管理」and the marketplace「分类和专家组管理」button). Two tabs: 专家组矩阵管理 and 标签管理 (the category CRUD above).
  - 岗位专家组 are **fully CRUD-manageable** via `server/src/modules/expert-domains/`: `GET /api/v1/expert-domains` is anonymous (homepage matrix + detail badges read it), create/update/delete require admin. Backed by the `expert_domains` table, seeded with the 9 default domains (mirroring the old frontend constant). The homepage「岗位专家组矩阵直达」cards render from this endpoint via `useExpertDomains` (constant fallback offline), with the card subtitle showing `description`.
  - 技能归属: `PUT /api/v1/skills/:id/expert-domains` body `{domains}` — a skill can belong to multiple domains, stored on `skills.expert_domains`; `expert_domain` stays as the primary domain for detail-page compatibility.
- `server/src/modules/skills/` — skill CRUD + ZIP upload/file-tree extraction + install-command generation + publish-to-git (`SkillsService`), DB-backed.
  - **ZIP 无损链路（重要）**: the frontend upload modal sends the **original ZIP as base64** (`zipBuffer`) plus the original filename (`zipFileName`), stored on `skills.zip_blob` / `skills.zip_file_name`. Downloads prefer `GET /api/v1/skills/:id/zip` (exact original file — name, size and binary content match the upload); the fallback `downloadSkillAsZip` rebuilds from `fileTree` with DEFLATE compression. Git publish (`approveSkill`/`relistSkill`/`reconcileGitMarketOnBoot`) passes the decoded original ZIP to `syncApprovedSkillToGit`, so what Claude Code installs is the real uploaded package, not a template shell. Regression group 15 asserts the round trip (upload base64 → download identical → Git has the real binary). Note: `jszip` must be imported as `import * as JSZip` in backend files (no `esModuleInterop` in server tsconfig; default-import compiles to `.default` which is undefined). approve/reject/delist/relist/delete now require admin (403 otherwise) — they previously had **no auth at all**. **Every new submission is created with `status: 'pending'` regardless of the dual-engine scan result** — the scan runs on upload and its score is stored as `auditScore` for the reviewer's reference, but only the admin's `approveSkill` triggers the Git-market publish. Do not reintroduce auto-approval on scan pass. The frontend upload modal (`UploadSkillModal`) is a simple form whose centerpiece is a ZIP upload widget: it parses the ZIP client-side with JSZip into a `FileTreeNode[]`, previews the tree, and auto-fills the skill name/description from `README.md`/`SKILL.md` (YAML frontmatter `name:`/`description:`, else the first `# heading` + first paragraph).
- `server/src/modules/audit/` — rules and reports persisted in DB; the regex engine in `runDualEngineScan` reads enabled rules from the repository; seeding happens in `onModuleInit`. Rule mutations and the LLM gateway config (`llm-config` GET/PUT/test) now require admin; rules GET and sandbox-scan stay anonymous (the frontend's local regex engine needs rule definitions pre-login).
- `server/src/modules/demands/` — skill-demand (bounty) market: list/create/approve/reject/delete, candidate submission and acceptance. **All bounty-point movement happens inside `dataSource.transaction()`** so a balance change can never be committed without the matching demand change. `pointsRefunded` makes refunds idempotent (reject-then-delete must not pay twice), and accepting a candidate sets it too, since the points went to the winner rather than back to the author. Seeds 2 example demands on first boot.
- `server/src/modules/auth/` — real JWT + bcrypt auth. **Role model is `super_admin` / `admin` / `user`** (the old `developer` value was renamed and migrated via the idempotent reconcile in `onModuleInit`). Identity model:
  - **普通员工用工号登录**（`users.employee_id`，唯一）；超级管理员用登录名 `admin`（`users.login_name`）。`POST /auth/login` accepts `account` and resolves `loginName → employeeId → email`; `email` is the legacy fallback channel (existing accounts predate 工号), the frontend only exposes 工号/登录名.
  - `POST /auth/register` takes `employeeId` + `name` + `password` (+ optional `email`/`department`) and **ignores any `role` field** — new accounts are always `user`. `super_admin` cannot be granted through `PATCH /auth/users/:id/role` either (whitelist `admin`/`user` only) and the super admin's own role is immutable. Only `super_admin` may call that PATCH.
  - `POST /auth/oss-login` is the internal-IAM single sign-on. `server/src/modules/auth/oss-iam.service.ts` is the **single pluggable seam**: without `IAM_BASE_URL` it accepts any 7-digit 工号 and auto-provisions (`authProvider='oss'`, unusable password hash); with `IAM_BASE_URL` it calls the real IAM. To integrate a real IAM, change only `OssIamService.fetchFromIam`.
  - `GET /auth/users` requires a valid token (no longer anonymous — it exposes emails/roles/points) and includes `employeeId` / `loginName` / `authProvider` so the 权限设置 page can search by 工号 and show the login method.
  - **AuthGuard is registered globally** via `APP_GUARD` in `app.module.ts` (it existed for a long time but was never wired in). Anonymous whitelist: skills GET, demands GET, auth login/register/oss-login, audit rules GET, sandbox-scan, and the git/claude-plugin protocol paths. Controllers still use per-route `resolveSession`/`assertPrivileged` for role checks.
  - Seeds 2 preset normal users (`7462201` / `7462202`, password `Password123!`) on an empty DB; the super admin (login `admin`, initial password `skill@2026`) is ensured by `ensureSuperAdmin()` on **every** boot (it upgrades a legacy `admin@skillhub.corp` row in place rather than duplicating it). `reconcileAccounts()` also backfills 工号 for legacy rows, renames `developer` → `user`, and gives admins default menu permissions; it is idempotent and runs on every startup, so deleting the DB row for the super admin self-heals on restart.
  - **Menu-level permissions** live on `users.menu_permissions` (simple-json, keys `audit` / `rules`). `super_admin` always has all menus (frontend derives `canAccessAudit`/`canAccessRules` with a super-admin fallback); `admin` sees 审核管理/风控中心 only if the key is present. `PATCH /auth/users/:id/menu-permissions` (super admin only, whitelist-validated, super-admin target rejected) updates them. The 权限设置 page lists only privileged users (admin + super admin) by default; typing in the search box reveals matching normal users so they can be promoted.
- `server/src/modules/feedback/` — 建议管理: `POST /api/v1/feedback` (submit), `GET /api/v1/feedback` (admins see all, normal users only their own), `DELETE /api/v1/feedback/:id` (admin or the submitter). No reply workflow. Backed by the `feedback` table. The frontend 建议管理 page (`/feedback` route, `FeedbackAdminView`) is reached from the header user dropdown ("建议管理"); admins get the moderation list, normal users get their own submissions plus a submit button (`FeedbackModal` posts to the API — localStorage `skillhub_feedback` is only an offline fallback and is no longer written back).

### The "dual-engine audit" exists twice, independently
The same concept is implemented separately in both apps, and the two do not share code:
- Frontend: `src/utils/auditRunner.ts` → `executeDualEngineAudit(skill, rules, onProgress, deepseekConfig)`
- Backend: `server/src/modules/audit/audit.service.ts` → `runDualEngineScan(payload)`

**"Engine 2" (LLM semantic review) is now a real model call, with a heuristic fallback.** `server/src/modules/audit/llm-audit.service.ts` calls any OpenAI-compatible `/chat/completions` gateway (通义千问 via 百炼兼容模式 / DeepSeek / vLLM / internal proxy) with timeout + exponential-backoff retry, then parses the model's JSON verdict (tolerating ```json fences and surrounding prose). **No LLM SDK is used anywhere** — plain `fetch`, so both the qwen and deepseek families work by pointing `baseUrl` at the right gateway. Key behaviours to preserve:
- **Never break the audit chain.** Any failure (not enabled, no credential, timeout, 4xx, unparseable output) degrades to the local heuristic verdict and stamps `llmVerdict.degradedReason`. Callers can tell the source apart via `llmVerdict.engine` (`'llm'` | `'heuristic'`) and `llmVerdict.model`.
- **4xx is not retried** (credential/param error); 429 and 5xx are.
- **Config is server-authoritative and single-row** (`llm_configs`, id `default`). `GET/PUT /api/v1/audit/llm-config` + `POST /api/v1/audit/llm-config/test` (real probe request, result persisted to `testStatus`/`testMessage`). The API **never returns the API key in plaintext** — only `apiKeyMask` + `hasApiKey`. `PUT` treats an omitted/empty `apiKey` as "keep current" and `null` as "clear + disable". These three endpoints are **admin-only**.
- `isEnabled` cannot be turned on without a stored credential (the server silently forces it back to `false`).
- Env vars `LLM_BASE_URL` / `LLM_MODEL_NAME` / `LLM_API_KEY` only **seed** the row on first boot (or backfill a missing key); afterwards the 风控中心 UI owns it. All three may be empty — the engine simply stays in heuristic mode.
- The frontend never stores the key: `App.tsx` strips `apiKey` before writing `skillhub_deepseek`, and `RuleManagementView` sends the form to the backend (blank key = unchanged) instead of simulating a handshake with `setTimeout`.
- `RuleManagementView`'s gateway tab offers provider quick-fill presets (`PROVIDER_PRESETS`): 通义百炼兼容模式 (`https://dashscope.aliyuncs.com/compatible-mode/v1`, qwen-* models), DeepSeek 官方 (`https://api.deepseek.com/v1`), and 内网自建网关.

## Conventions & gotchas

- **Types are duplicated** between `src/types/index.ts` (frontend) and server-side interfaces (`AuditRule`, `PluginManifestItem`, …). There is no shared package — keep them in sync manually when changing a domain type.
- **Business functions must have Chinese comments** — explicit project rule (README 开发规范). Follow existing comment style (`/** ... */` docblocks).
- **Frontend state persistence pattern**: business state is seeded from `src/mock/initialData.ts` constants and refreshed from the backend; nothing is written back to `localStorage` (that was the old offline-persistence pattern and was removed — business data lives in the database only). `ErrorBoundary` in `src/main.tsx` offers a "reset cache" that clears the auth session and any vestigial `skillhub_*` keys, then reloads.
- **`DISABLE_HMR=true`** env var disables Vite HMR and file watching — designed for AI Studio / agent-driven editing. `vite.config.ts` explicitly warns not to modify this behavior.
- `@/` import alias resolves to the repo root.
- **`server/storage/` is runtime data** (the git marketplace repo) and is gitignored. It is regenerated/seeded automatically on server startup (`onModuleInit`), so don't commit or edit files there.
- The server depends on native builds (`pg`, `esbuild`) — `pnpm-workspace.yaml` lists them in `allowBuilds`.
- **What is backend-backed vs local-only.** Backend-backed: skills/users/rules/demands bootstrap, JWT login/register/profile, skill upload, approve/reject/delist/relist/delete, like/star/download counters, audit-score writeback, user role + points, audit rule save/toggle/delete, and the full demand + bounty lifecycle. Also backend-backed now: the LLM audit-engine gateway config (`/api/v1/audit/llm-config`) and the semantic verdict itself (`auditRunner.ts` calls `POST /api/v1/audit/sandbox-scan` and lets the server verdict override its local keyword guesses). Still local-only (`localStorage`): feedback submissions, plus non-sensitive LLM display fields. The app is React 19 + Vite (not Remix).
- **Points are server-authoritative.** Frontend demand handlers never compute a balance; they call the API and then `refreshPointsFromServer()` (which re-reads `/auth/me` + `/auth/users`). `GET /auth/me` deliberately re-reads the DB rather than trusting JWT claims — the token payload has no `points` and its `role` goes stale after an admin change.
- **Modal components must not fire optimistic success toasts** for actions whose handler awaits the backend. `SkillDemandDetailModal` used to toast "已审核通过" before the request resolved, so a server rejection showed both success and failure. Toasts for those flows belong in the `App.tsx` handler, driven by the response.
- **Slug handling lives server-side.** `SkillsService.resolveUniqueSlug` derives an ASCII kebab-case slug from `name` when `slug` is omitted, strips non-ASCII (Chinese names fall back to `skill-<base36>`), and appends `-2`, `-3`, … on collision — plugin directory names and `/plugin install` commands must stay ASCII. `createSkill` rejects a missing `name`/`description` with 400 instead of throwing 500.
- **Dev-server proxy**: `vite.config.ts` proxies `/api`, `/skillhub.git`, `/market.git`, and `/.claude-plugin` to `BACKEND_TARGET` (default `http://127.0.0.1:3001`) and sets `allowedHosts: true`, so a tunnelled origin serves frontend + backend same-origin. Vite falls through to :7002+ if :7001 is taken.
- **`5xx` on `/api/*` almost always means the NestJS process is not running**, not a missing endpoint. The frontend has no backend of its own — with the proxy's upstream down you get a gateway error, not a 404. `backendProxy()` in `vite.config.ts` converts the connection failure into `502 {"message": "无法连接后端服务 …请先运行 pnpm run server:dev"}` (Vite's default is a body-less 500, which reads like a broken handler). Check `ss -ltnp | grep 3001` first.

## Testing

There is no unit-test framework. Regression is covered by two executable suites (both require the backend running on the target origin):

```bash
pnpm run lint             # tsc --noEmit (frontend); server has its own tsconfig
pnpm run test:regression  # node scripts/regression-test.mjs [baseUrl]  — API assertions (≈282, varies with marketplace plugin count)
pnpm run test:plugin-e2e  # bash scripts/claude-plugin-e2e.sh [gitUrl] — 165 assertions via the real claude CLI
pnpm run test:all         # lint + both suites
```

- `scripts/regression-test.mjs` covers auth, skill lifecycle, bounty/points transactions, audit rules + sandbox scan (including a curated set of dangerous payloads), marketplace manifest contract, SPA/API coexistence, the LLM engine's six failure branches (spinning up a throwaway mock gateway on `127.0.0.1:17899`), uuid primary-key robustness, and cleans up everything it creates. It restores the LLM config it found before running.
- `scripts/claude-plugin-e2e.sh` shells out to the real `claude plugin` commands (`marketplace add` → `install` → `list` → cache-layout checks → `uninstall` → `marketplace remove`) and backs up `~/.claude/plugins/known_marketplaces.json` first. It exits 0 with a skip message if `claude` isn't installed.
- Both suites accept a base URL, so the same checks run against the public tunnel: `node scripts/regression-test.mjs https://souxy.com:7300`.

## Claude Code plugin marketplace contract

`git-market.service.ts` generates the repo that Claude Code clones, so its output must match the CLI's schema exactly. Verified against `claude` v2.1.245:

- `marketplace.json` requires `owner` as an **object** (`{name, email?}`) — a missing `owner` fails `marketplace add` outright.
- Per-plugin `plugin.json` requires `skills` to be an array of **directories** (`["./"]` or `["./skills"]`). Pointing at a file (`["skills/SKILL.md"]`) fails install with `Validation errors: skills: Invalid input`.
- `author` must be an object in both files, never a bare string.
- `SKILL.md` needs YAML frontmatter (`name`, `description`) or the skill silently isn't loaded.
- A `v` prefix in `version` (`v1.2.0`) is accepted.
- Plugin names come from `toPluginName(slug)`, which strips the `@skillhub/` scope so the generated directory matches the `installCommands.claude` string shown in the UI. Keep those two in sync or copy-pasting from the detail page breaks.
- `SkillsService.reconcileGitMarketOnBoot()` self-heals on startup: it re-syncs any approved skill missing from the manifest **or** whose on-disk layout fails `isPluginLayoutValid()` (legacy `skills: [*.md]` / string `author`), then rebuilds the index to drop stale directories. Deleting `server/storage/git-marketplace` is safe.

### Install-detail commands are origin-dynamic
`src/utils/marketplace.ts` derives the marketplace git URL from `VITE_API_BASE_URL` or `window.location.origin`, so `marketplace add <origin>/skillhub.git` works unchanged across dev/test/prod (e.g. `tech-dev.com:17200`). `getMarketplaceAddCommand()` → `claude plugin marketplace add <url>`; `getMarketplaceUpdateCommand()` → `claude plugin marketplace update skillhub` (shown with a copy button on the skill detail install section — new plugins are not installable until clients run it). Claude Code layout: `marketplace add` clones the source repo to `~/.claude/plugins/marketplaces/skillhub/`; `plugin install` copies the single plugin to `~/.claude/plugins/cache/skillhub/<plugin>/<version>/` (what Claude Code actually loads; uninstalls do not clear the cache dir).

### Skill detail deep-link must never white-screen
Refreshing on `/skill/:slug` may find the skill only on the server. `selectedSkill` init matches the mock constants only; a dedicated effect fetches `GET /api/v1/skills/:slug` when `currentTab === 'detail' && !selectedSkill` (with `detailLoading` state), and the render branch falls back to a "loading / not found" placeholder instead of rendering nothing. Keep that ternary (`selectedSkill ? <SkillDetailPage/> : placeholder`) — dropping the null branch reintroduces the white screen.

### Floating feedback + back-to-top
`BackToTop` is globally mounted in `App.tsx` and fixed at `bottom-24 right-6` on every page. The「建议反馈」button is vertical-text (`writing-mode: vertical-rl`), visible to **all** users, and navigates to `/feedback`; that route renders `FeedbackAdminView` for any logged-in user (admins manage all, normal users see their own + submit via `FeedbackModal`), with a login prompt when logged out. The「建议管理」dropdown item stays admin-only.

### fileTree content vs zipBlob
`createSkill` stores the frontend-provided `fileTree` (which includes text `content` for the detail-page file preview) **in preference to** parsing the uploaded ZIP for structure — the parser produces no `content`, so overriding with it would blank the preview. The original ZIP itself lives on `skills.zip_blob` (base64) + `zip_file_name`, powering lossless download and Git publish. When adding fields to `SkillEntity`, remember `fileTree` / `installCommands` / `auditScore` etc. are camelCase columns (no `name:` mapping).

## Deployment

`deploy/README.md` has the details. In short: `server/src/main.ts` serves `../dist` (static + SPA history fallback) when it exists, so production is a **single process** on `:3001` — no Vite. The fallback middleware must be registered with `app.use()` **before** `listen()`; adding routes after `listen()` has no effect on Express 4. `deploy/skillhub-server.service` is a systemd **user** unit (`Restart=always`, linger enabled); frp's `skillhub` proxy must point at 3001, not Vite's 7001.
