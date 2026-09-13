# Supabase Inventory (Ranked Gym)

This appendix inventories every Supabase dependency found in-repo at `START_SHA=f0ef5ecb5cde38aa42fab1e67dfa80cdf4eae9b4`.

## 1) Packages and tooling

- Runtime package:
  - `@supabase/supabase-js` in `package.json`.
- Lockfile transitive Supabase packages in `package-lock.json`:
  - `@supabase/auth-js`
  - `@supabase/functions-js`
  - `@supabase/postgrest-js`
  - `@supabase/realtime-js`
  - `@supabase/storage-js`
  - `@supabase/phoenix`
- Supabase project folder and SQL migrations:
  - `supabase/` (config, migrations, edge functions, schema scripts).

## 2) Environment variable names (names only)

### Client/runtime

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL` (used by password reset redirect logic)

### Supabase edge functions / server-side

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Supabase config.toml referenced secrets

- `SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN`
- `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET`

## 3) File-by-file Supabase usage inventory

### 3.1 Client boot/config/auth/session

- `src/lib/supabase.ts`
  - Creates Supabase client, validates env, config banner messages.
  - Enables persisted session + token refresh + URL session detection.
- `src/services/secureAuthStorage.ts`
  - Custom secure storage adapter for Supabase auth tokens.
- `src/context/AuthContext.tsx`
  - Bootstraps `supabase.auth.getSession()`, `onAuthStateChange`.
  - Handles `PASSWORD_RECOVERY`, sign-in/sign-out hydration flow.
- `src/services/authService.ts`
  - `signUpWithEmail`, `signInWithPassword`, `signOut`, reset password, update password.
  - Uses RPC `delete_own_account`.
- `src/utils/authRedirect.ts`
  - Reset-password redirect policy for Supabase email flow.
- `src/components/auth/AuthBottomSheet.tsx`
  - UI flows wired to Supabase auth actions through `AuthContext`.
- `src/components/settings/SecurityScreen.tsx`
  - Change password + account deletion UX calling Supabase auth/RPC.

### 3.2 Domain data and RPC usage

- `src/services/cloudBackup.ts`
  - Core cloud backup/sync pipeline (read/write Supabase tables + fallback blob).
  - Tables: `nutrition`, `workouts`, `profiles`, `user_backups`.
- `src/services/checkinService.ts`
  - Table `checkins` create/list/count.
- `src/services/avatarService.ts`
  - Storage bucket `avatars` upload/public URL + `profiles.avatar_url` update.
- `src/services/alimentsService.ts`
  - Table `aliments` insert scanned products.
- `src/services/streakService.ts`
  - Table `profiles` conditional update for streak/idempotence.
- `src/services/profileStats.ts`
  - Depends on Supabase checkin count and synced workout history.
- `src/services/userStatsService.ts`
  - RPC `get_user_stats`.
- `src/services/activityFeedService.ts`
  - RPCs `get_social_activity_feed` and `record_activity`.
- `src/services/mealPhotoAi.ts`
  - Reads `ai_usage_limits`, requires authenticated session token.
  - Invokes Supabase edge function `analyze-meal-photo`.
- `src/components/lobby/LobbyView.tsx`
  - Writes checkins when auth + Supabase is configured.
- `src/components/profile/CloudBackupCard.tsx`
  - Product messaging/status tied to Supabase backup.

### 3.3 Supabase SQL schema/migrations/config

- `supabase/schema.sql`
  - Canonical table creation, trigger, RLS, storage bucket policies.
- `supabase/user_backups.sql`
  - Minimal migration helper script.
- `supabase/config.toml`
  - Supabase local stack/auth/storage config with secret env references.
- `supabase/migrations/20260821100520_ranked_gym_schema.sql`
- `supabase/migrations/20260821111500_profile_daily_streak.sql`
- `supabase/migrations/20260821140000_profile_avatar_storage.sql`
- `supabase/migrations/20260821163000_workouts_rls_write_fix.sql`
- `supabase/migrations/20260821190000_ai_usage_limits.sql`
- `supabase/migrations/20260821194500_ai_meal_scan_limit_5.sql`
- `supabase/migrations/20260822150000_profile_ghost_mode.sql`
- `supabase/migrations/20260822160000_security_privacy_hardening.sql`
- `supabase/migrations/20260822170000_feed_ghost_anonymity.sql`
- `supabase/migrations/20260823140000_get_user_stats.sql`
- `supabase/migrations/20260824120000_delete_own_account.sql`
- `supabase/migrations/20260824130000_fix_weekly_sessions_count.sql`

### 3.4 Supabase edge functions

- `supabase/functions/analyze-meal-photo/index.ts`
  - Supabase auth verification + service-role RPC quota usage + Gemini call.
- `supabase/functions/nutrition-engine/index.ts`
  - Hosted via Supabase edge runtime.
- `supabase/functions/sleep-engine/index.ts`
  - Hosted via Supabase edge runtime.
- `supabase/functions/analyze-meal-photo/deno.json`
  - Runtime config for that function.

### 3.5 Types/docs/deployment references

- `src/types/database.ts`
  - Typed Supabase tables/views/functions contract.
- `src/vite-env.d.ts`
  - Declares Supabase env names.
- `.env.example`
  - Supabase env setup examples.
- `docs/SUPABASE_SETUP.md`
- `docs/CLOUDFLARE_PAGES.md`
- `docs/CLOUDFLARE_WORKERS.md`
- `docs/NUTRITION_ENGINE.md`
- `docs/SLEEP_ENGINE.md`
- `.gitignore` (`supabase/.temp/` ignore rule)

### 3.6 Tests coupled to Supabase behavior

- `src/services/authPasswordRecovery.test.ts`
- `src/services/streakService.concurrency.test.ts`
- `src/services/cloudBackup.activeUserIdRace.test.ts`

## 4) Supabase data model currently in use

### Tables

- `profiles`
- `workouts`
- `nutrition`
- `checkins`
- `aliments`
- `user_backups` (legacy fallback and mirror)
- `activities`
- `ai_usage_limits`

### View

- `profiles_public`

### Trigger/function bootstrap

- Trigger: `on_auth_user_created` on `auth.users`
- Trigger fn: `handle_new_user`

### RPC/functions used by app

- `delete_own_account`
- `get_social_activity_feed`
- `record_activity`
- `get_user_stats`
- `reserve_ai_meal_scan`
- `release_ai_meal_scan`
- Utility SQL functions used by feed RPC:
  - `haversine_km`
  - `smooth_distance_label`

## 5) RLS and policy inventory

### Core row ownership policies

- `profiles`: owner select/update/insert + explicit anon deny in hardening migration.
- `workouts`: owner select/insert/update/delete.
- `nutrition`: owner select/insert/update/delete.
- `checkins`: owner select/insert/delete + explicit anon deny in hardening migration.
- `user_backups`: owner select/insert/update/delete.
- `activities`: owner select/insert + explicit anon deny.
- `ai_usage_limits`: owner select only; writes through service role RPC.

### Mixed visibility policy

- `aliments`: select own or public (`user_id is null`), insert own, delete own.

### Storage policies (`storage.objects`, bucket `avatars`)

- Public read for bucket `avatars`.
- Authenticated users may insert/update/delete only in folder prefix matching `auth.uid()`.

## 6) Auth/session/recovery/account-deletion flow inventory

- Session boot:
  - `auth.getSession()` at app load.
  - `onAuthStateChange` events: `INITIAL_SESSION`, `TOKEN_REFRESHED`, `SIGNED_IN`, `USER_UPDATED`, `PASSWORD_RECOVERY`, sign-out path.
- Password reset:
  - `resetPasswordForEmail(email, { redirectTo })`.
  - Recovery completion on `PASSWORD_RECOVERY` then `updateUser({ password })`.
- Password change:
  - Reauth via `signInWithPassword`, then `updateUser`.
- Account deletion:
  - Client reauth, then RPC `delete_own_account` removes `auth.users` row (cascade).

## 7) Cloud backup/sync inventory (Supabase-specific)

Current source code behavior (`src/services/cloudBackup.ts`):

- Local writes in nutrition/training/profile/lobby/sleep trigger `notifyLocalDataChanged`.
- Sync readiness gate:
  - On login, app runs pull-first hydration (`hydrateCloudBackupForUser` -> `pullCloudBackup`).
  - Auto-push deferred until hydration finishes (`cloudSyncReady`) to avoid empty-local overwrite.
- Remote read sources:
  - Primary: `nutrition`, `workouts`, `profiles` selected JSON columns.
  - Fallback legacy blob: `user_backups.payload`.
- Remote write targets:
  - Upsert `nutrition`, `workouts`, `profiles`.
  - Mirror/fallback writes to `user_backups`.
- Error handling:
  - Missing-table fallback, RLS/auth detection, backup status events.
- App events:
  - `ranked-gym:backup-saved`
  - `ranked-gym:backup-error`
  - `ranked-gym:backup-restored`

Note: `sleepStorage` triggers cloud sync, but `collectLocalBackup()` does not include sleep payload yet. Sleep is currently local-only despite cloud trigger calls.
