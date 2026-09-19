# Convex setup — Ranked Gym

**Supabase remains the default runtime.** Do not enable Convex as primary in production until iPhone signoff.

Full architecture: `docs/migrations/supabase-to-convex-plan.md`
Inventory: `docs/migrations/supabase-to-convex-inventory.md`

## What has landed

- `convex/schema.ts` — compatibility schema for Profil, Train, Nutrition, Hydratation (nested in nutrition journal), Sommeil, Streak, file metadata, and migration bookkeeping.
- `convex/auth.ts` + `convex/authPrivateData.ts` — PR-E auth behind `VITE_ENABLE_CONVEX_AUTH` (global password reset, no legacy hash bridge).
- `convex/sync.ts` + `convex/profiles.ts` — PR-F backup/sync + profile/streak read/write behind `VITE_ENABLE_CONVEX_PRIMARY`.
- `convex/rpc.ts` — PR-G checkins/feed/stats and AI usage reserve/release equivalents with session-based user isolation.
- `convex/files.ts` — private avatar lifecycle on Convex storage (`upload` / `signed download` / `delete`) with owner checks + migration helpers.
- `scripts/migrations/supabase/*.mjs` — PR-I export/import/verify scripts with dry-run fake-data workflow and deterministic id mapping.
- `scripts/migrations/supabase/avatar-storage.mjs` — PR-H Supabase `avatars` bucket inventory + Convex import path (dry-run or execute).
- Adapter: `src/backend/adapter.ts` — `getActiveCloudBackend()` is `'supabase'` unless Convex is configured **and** `VITE_ENABLE_CONVEX_PRIMARY=true`.

## Environment variable names (no secrets)

Client / Vite build:

| Name | Role |
|------|------|
| `VITE_CONVEX_URL` | Convex deployment URL (`https://….convex.cloud`) |
| `VITE_ENABLE_CONVEX_PRIMARY` | Switch domain backup/sync (profile/train/nutrition/sleep/streak) to Convex. Keep unset/`false` until validation. |
| `VITE_ENABLE_CONVEX_AUTH` | Enable Convex auth adapter (PR-E). Keep unset/`false` until auth validation passes. |
| `VITE_PUBLIC_APP_URL` | Public HTTPS origin (already used for password-reset links) |

Convex CLI / backend (local `.env.local` only, never git):

| Name | Role |
|------|------|
| `CONVEX_DEPLOYMENT` | CLI selected deployment |
| `CONVEX_DEPLOY_KEY` | Deploy key |
| `CONVEX_AUTH_SECRET` | Auth signing secret (later phase) |
| `CONVEX_AUTH_EMAIL_FROM` | Reset-mail sender (later phase) |
| `CONVEX_AUTH_RESET_REDIRECT_URL` | Reset-mail redirect (later phase) |
| `CONVEX_AUTH_RESET_TOKEN_TTL_MIN` | Reset token TTL (later phase) |
| `CONVEX_AUTH_SESSION_TTL_HOURS` | Session lifetime (optional override) |
| `CONVEX_FILE_SIGNED_URL_TTL_SEC` | Avatar URL TTL (later phase) |
| `MIGRATION_ADMIN_SECRET` | Server-only Convex env + local script env. Gates internal migration/auth-admin functions. Never `VITE_*`. High-entropy, ≥16 chars. |

Migration scripts (runtime env only):

- `MIGRATION_SUPABASE_URL`
- `MIGRATION_SUPABASE_SERVICE_ROLE_KEY`
- `MIGRATION_CONVEX_URL`
- `MIGRATION_CONVEX_ADMIN_KEY`
- `MIGRATION_ADMIN_SECRET`
- `MIGRATION_RUN_SECRET` (optional; defaults to `MIGRATION_ADMIN_SECRET`)
- `MIGRATION_RUN_ID`

Copy names from `.env.example`. Leave values empty in git.

## Migration scripts (PR-I)

Always validate migration logic with fake data before touching live credentials:

```bash
npm run migration:supabase:dry-run
```

Live export/import/verify (never commit secrets):

```bash
npm run migration:supabase:export -- --run-id <run-id>
npm run migration:supabase:import -- --input scripts/migrations/artifacts/<run-id>.supabase-export.json --source-sha <git-sha>
npm run migration:supabase:verify -- --bundle scripts/migrations/artifacts/<run-id>.supabase-export.json --import-report scripts/migrations/artifacts/<run-id>.convex-import-report.json
```

Safety constraints:
- no script deletes Supabase data
- import is idempotent via `migration_entity_map` keys (`entityType + supabaseId`)
- verify compares per-entity counts before/after

## Avatar storage migration (PR-H)

Inventory-only dry-run (safe in CI/local, no Convex writes):

```bash
npm run migration:supabase:avatars -- --dry-run --run-id <run-id>
```

End-to-end upload/import execution (requires runtime-only secrets, never commit):

```bash
npm run migration:supabase:avatars -- --execute --run-id <run-id> --source-sha <git-sha>
```

What it does:
- reads `storage.objects` entries from Supabase bucket `avatars`
- derives owning `userId` from object path prefix (`<userId>/...`)
- uploads binaries into Convex storage
- writes `user_files` metadata + `profiles.avatarFileId` pointer through `convex/files.ts`
- writes report: `scripts/migrations/artifacts/<run-id>.avatar-storage-report.json`

Notes:
- requires Convex admin key (`MIGRATION_CONVEX_ADMIN_KEY` via `setAdminAuth`) plus `MIGRATION_ADMIN_SECRET`
- calls internal functions (`internal.migrations.startRun`, `internal.files.importSupabaseAvatar`, …)
- each run stores a hash of a non-derivable `runSecret` (`MIGRATION_RUN_SECRET` or `MIGRATION_ADMIN_SECRET`); inventing a `runId`/`sourceSha` is not enough
- skips malformed object paths and reports warnings
- never deletes Supabase bucket objects

## Create a Convex project (Evan)

Cloud `npx convex dev` / `npx convex login` needs Evan to authenticate in the **shared browser**. Do not paste passwords or tokens in chat.

```bash
npx convex login
npx convex dev
```

The CLI writes `VITE_CONVEX_URL` and `CONVEX_DEPLOYMENT` to `.env.local` (gitignored).

Anonymous/local backends may work without an account; that is optional for Phase A. Checked-in `convex/_generated/` types are enough to typecheck without a live deployment.

## Locked for later Auth PRs (not Phase A)

If Supabase password hashes are not safely portable to Convex: **global password reset for all users**. Do not build a legacy password bridge.

## PR-E auth migration flow (global reset policy)

1. Import legacy users without password hashes into `auth_users` (internal Convex mutation `internal.auth.importUsersWithoutPasswords`, admin secret or admin-role session).
2. Imported users are flagged `mustResetPassword=true`; password login is denied until reset.
3. Queue reset campaign emails with `internal.auth.queueGlobalPasswordResetCampaign`.
4. Complete reset via tokenized link to `/auth/reset-password?token=...` then `auth.consumePasswordReset`.

This preserves the locked policy: no hash portability shortcuts and no legacy password bridge.

## Out of scope (do not do yet)

- Removing Supabase
- Production Convex deploy
- Merging to `main`
