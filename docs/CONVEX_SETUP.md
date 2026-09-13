# Convex setup — Ranked Gym

**Supabase remains the default runtime.** Do not enable Convex as primary in production until iPhone signoff.

Full architecture: `docs/migrations/supabase-to-convex-plan.md`
Inventory: `docs/migrations/supabase-to-convex-inventory.md`

## What has landed

- `convex/schema.ts` — compatibility schema for Profil, Train, Nutrition, Hydratation (nested in nutrition journal), Sommeil, Streak, file metadata, and migration bookkeeping.
- `convex/auth.ts` + `convex/authPrivateData.ts` — PR-E auth behind `VITE_ENABLE_CONVEX_AUTH` (global password reset, no legacy hash bridge).
- `convex/sync.ts` + `convex/profiles.ts` — PR-F backup/sync + profile/streak read/write behind `VITE_ENABLE_CONVEX_PRIMARY`.
- `convex/files.ts` — private `user_files` avatar scaffolding (full storage cutover is CODEX-RISK PR-H).
- `convex/codexRiskStubs.ts` — PR-G/PR-I leftovers (checkins/feed/stats RPC + migration scripts).
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

Migration scripts (later phase, runtime env only):

- `MIGRATION_SUPABASE_URL`
- `MIGRATION_SUPABASE_SERVICE_ROLE_KEY`
- `MIGRATION_CONVEX_URL`
- `MIGRATION_CONVEX_ADMIN_KEY`
- `MIGRATION_RUN_ID`

Copy names from `.env.example`. Leave values empty in git.

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

1. Import legacy users without password hashes into `auth_users` (Convex mutation `auth.importUsersWithoutPasswords`).
2. Imported users are flagged `mustResetPassword=true`; password login is denied until reset.
3. Queue reset campaign emails with `auth.queueGlobalPasswordResetCampaign`.
4. Complete reset via tokenized link to `/auth/reset-password?token=...` then `auth.consumePasswordReset`.

This preserves the locked policy: no hash portability shortcuts and no legacy password bridge.

## Out of scope (do not do yet)

- Live data export/import (CODEX-RISK PR-I)
- Checkins / social feed / stats RPC equivalents (CODEX-RISK PR-G)
- Removing Supabase
- Production Convex deploy
- Merging to `main`
