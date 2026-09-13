# Convex setup — Ranked Gym (Phase A)

Scaffold only. **Supabase remains the default runtime.** Do not enable Convex as primary in production.

Full architecture: `docs/migrations/supabase-to-convex-plan.md`
Inventory: `docs/migrations/supabase-to-convex-inventory.md`

## What this phase added

- `convex/schema.ts` — compatibility schema for Profil, Train, Nutrition, Hydratation (nested in nutrition journal), Sommeil, Streak, file metadata, and migration bookkeeping.
- `convex/health.ts` — public `ping` query (no user data).
- `convex/lib/auth.ts` — `requireAuthUser` helper for later phases (auth is **not** migrated yet).
- React wiring: `ConvexClientProvider` mounts only when `VITE_CONVEX_URL` is a real URL. Default builds are a passthrough.
- Adapter: `src/backend/adapter.ts` — `getActiveCloudBackend()` is always `'supabase'` in Phase A. Local storage paths are unchanged.

## Environment variable names (no secrets)

Client / Vite build:

| Name | Role |
|------|------|
| `VITE_CONVEX_URL` | Convex deployment URL (`https://….convex.cloud`) |
| `VITE_ENABLE_CONVEX_PRIMARY` | Request Convex as primary. Phase A does **not** switch domain I/O. Keep unset/`false`. |
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

## Out of scope (do not do yet)

- Auth / session / password-hash migration
- Live data export/import
- Removing Supabase
- Production Convex deploy
- Merging to `main`
