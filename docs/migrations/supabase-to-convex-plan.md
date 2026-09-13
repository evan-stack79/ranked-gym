# Ranked Gym: Supabase -> Convex Migration Plan (Architecture Only)

Status: Phase A scaffold landed (schema + client wiring + feature flag). Production runtime is still Supabase. No live data or auth migration in this pass.

Scope locked by Evan:

- Replace Supabase for database, auth, sessions, password recovery, cloud backup/sync, file storage, and domain data.
- Domains in scope: Profil, Train, Nutrition, Hydratation, Sommeil, Streak.
- End state: no active Supabase dependency in normal app operation.
- Supabase remains available as rollback source until explicit cutover approval after iPhone validation.

See full inventory appendix: `docs/migrations/supabase-to-convex-inventory.md`.

---

## 1) Full inventory summary of Supabase usage

Canonical inventory is in `docs/migrations/supabase-to-convex-inventory.md` and includes:

- All files with Supabase coupling (client, services, UI, SQL, migrations, docs, tests).
- Packages and lockfile transitive dependencies.
- Env var names (names only).
- SQL schema objects, RLS policies, RPCs, triggers, view, and storage bucket policies.
- Auth/session/reset/deletion flows and cloud backup/sync behavior.

Key high-risk coupling points to replace:

1. `src/context/AuthContext.tsx` + `src/services/authService.ts` (full auth lifecycle).
2. `src/services/cloudBackup.ts` (pull-first safety and sync state machine).
3. `src/services/avatarService.ts` (Supabase Storage bucket `avatars`).
4. Supabase SQL RPCs:
   - `get_social_activity_feed`
   - `record_activity`
   - `get_user_stats`
   - `delete_own_account`
   - `reserve_ai_meal_scan`
   - `release_ai_meal_scan`

---

## 2) Proposed Convex schema mapping (all required domains)

Design goal: minimize migration risk by preserving current data shapes first (compatibility schema), then normalize later.

## 2.1 Core collections (v1 compatibility-first)

1. `profiles`
   - Fields: `userId`, `pseudo`, `level`, `xp`, `rank`, `discipline`, `avatarFileId`, `isGhostModeEnabled`, `createdAt`, `updatedAt`.
   - Lobby fields moved out of profile row (better separation): custom spots/check-in into dedicated collections.
   - Indexes:
     - `by_userId` (unique)
     - `by_updatedAt`
   - Source: Supabase `profiles`.

2. `workouts_state`
   - Fields: `userId`, `stateJson`, `progressJson`, `updatedAt`.
   - Indexes:
     - `by_userId` (unique)
     - `by_updatedAt`
   - Source: Supabase `workouts`.

3. `nutrition_state`
   - Fields: `userId`, `profileJson`, `journalJson`, `updatedAt`.
   - Indexes:
     - `by_userId` (unique)
     - `by_updatedAt`
   - Source: Supabase `nutrition`.
   - Includes hydration data currently nested in journal (`waterEntries`, bottle calibration data).

4. `sleep_nights`
   - Fields: `userId`, `dateKey`, `bedtime`, `waketime`, `tstHours`, `createdAt`, `updatedAt`.
   - Indexes:
     - `by_userId_dateKey` (unique composite)
     - `by_userId_updatedAt`
   - Source: currently local storage only (`sleepStorage`), no Supabase source table.

5. `checkins`
   - Fields: `userId`, `salleNom`, `salleLat`, `salleLng`, `gymPayload`, `createdAt`.
   - Indexes:
     - `by_userId_createdAt`
   - Source: Supabase `checkins`.

6. `custom_spots`
   - Fields: `userId`, `spotId`, `name`, `lat`, `lng`, `address`, `metadata`, `createdAt`, `updatedAt`.
   - Indexes:
     - `by_userId_spotId` (unique composite)
     - `by_userId_updatedAt`
   - Source: currently in `profiles.custom_spots` JSON.

7. `active_checkins`
   - Fields: `userId`, `checkinJson`, `updatedAt`.
   - Indexes:
     - `by_userId` (unique)
   - Source: currently in `profiles.active_checkin` JSON.

8. `aliments`
   - Fields: `userId`, `nom`, `calories`, `proteines`, `glucides`, `lipides`, `barcode`, `createdAt`.
   - Indexes:
     - `by_userId_createdAt`
     - `by_barcode`
   - Source: Supabase `aliments`.

9. `activities`
   - Fields: `userId`, `activityType`, `actionText`, `xpEarned`, `originLat`, `originLng`, `createdAt`.
   - Indexes:
     - `by_createdAt`
     - `by_userId_createdAt`
   - Source: Supabase `activities`.

10. `ai_usage_limits`
   - Fields: `userId`, `dateOfScan` (Paris key), `scanCount`, `updatedAt`.
   - Indexes:
     - `by_userId_dateOfScan` (unique composite)
   - Source: Supabase `ai_usage_limits`.

11. `streak_state` (optional explicit table in v1; can also remain in profile fields)
   - Fields: `userId`, `currentStreak`, `lastLoginDate`, `updatedAt`.
   - Indexes:
     - `by_userId` (unique)
   - Source: Supabase `profiles.current_streak`, `profiles.last_login_date`.

## 2.2 File storage collections

12. `user_files`
   - Fields: `userId`, `kind` (`avatar`), `storageId`, `contentType`, `sizeBytes`, `sha256`, `createdAt`, `replacedAt`.
   - Indexes:
     - `by_userId_kind`
     - `by_storageId` (unique)
   - Source: Supabase Storage bucket `avatars`.

## 2.3 Migration bookkeeping collections

13. `migration_runs`
   - Fields: `runId`, `startedAt`, `finishedAt`, `status`, `sourceSha`, `summaryJson`.
   - Indexes: `by_runId` (unique), `by_startedAt`.

14. `migration_entity_map`
   - Fields: `runId`, `entityType`, `supabaseId`, `convexId`, `checksum`, `importedAt`.
   - Indexes:
     - `by_entity_supabaseId` (unique composite on `entityType+supabaseId`)
     - `by_runId_entityType`

15. `legacy_supabase_backups` (temporary rollback support)
   - Fields: `userId`, `payloadJson`, `updatedAt`, `source` (`supabase_user_backups`).
   - Indexes: `by_userId`.
   - Source: Supabase `user_backups`.

---

## 3) Convex auth design (sessions, password reset, account deletion)

Recommended baseline:

- Use Convex auth stack with email/password support and server-side session validation.
- Keep current product behavior:
  - Email/password sign-in.
  - Public signup disabled by default (private beta mode).
  - Password recovery by email link.
  - Password change (reauth + update).
  - Account deletion requiring password confirmation.

Session handling target:

- Web: secure HttpOnly session cookie (or Convex auth token flow managed by official auth integration).
- Native (Capacitor): session tokens stored in secure storage (same model as current `secureAuthStorage` intent).
- Keep `AuthContext` API stable to reduce UI churn.

Password reset flow target:

1. User requests reset link.
2. Convex action creates one-time reset token with TTL.
3. Email link opens app on allowed HTTPS origin/deep link.
4. New password submission consumes token atomically and rotates sessions.

Account deletion target:

1. User reauthenticates.
2. Mutation marks account `pendingDeletion` and revokes active sessions.
3. Background job removes user-owned docs/files and final identity record.
4. Optional retention buffer (short delay) can be used during beta, then disabled at cutover.

### Password hash migration risk (hard gate)

STOP gate before implementation:

- We must verify whether Supabase auth password hashes can be migrated safely into the selected Convex auth implementation.
- If hashes are not portable/compatible without unsafe custom handling, do not attempt direct hash transfer.

**Locked product decision (Evan, 2026-09-13):** if hashes are not safely portable to Convex, use a **global password reset for all users**. Do **not** build a legacy password-verification bridge. No unsafe password export/import shortcuts.

This decision does not change Phase A (schema + scaffold + feature flag). Apply it in later Auth PRs only.

---

## 4) Access rules: strict user isolation (A cannot read/write B)

Policy baseline in Convex:

- Every query/mutation resolves authenticated `userId`.
- Every document in user-owned collections includes `userId`.
- Reads/writes always filter/check `doc.userId === authUserId`.
- No client-supplied `userId` trusted without server-side check.

Special-case endpoints:

- Social feed can return cross-user activity rows, but only sanitized fields:
  - No raw coordinates.
  - Ghost mode anonymization preserved (`Athlete Furtif` behavior).
- File fetch URLs only issued after owner check.

Required guard helper:

- Central `requireAuthUser(ctx)` helper used by all protected functions.
- Add explicit authorization tests for each collection.

---

## 5) Backup/sync/offline/local overwrite-protection preservation strategy

Current safety invariant to preserve:

- On login, remote cloud data must hydrate local first.
- Local auto-push must remain blocked until hydration finishes.
- This prevents blank local cache from overwriting cloud state.

Convex strategy:

1. Keep per-user local cache scoping (`...:u:<userId>` key pattern).
2. Introduce sync bootstrap endpoint returning latest server snapshots + versions.
3. Keep `cloudSyncReady` gate; defer local pushes until bootstrap complete.
4. Add durable local outbox:
   - each mutation gets `clientMutationId` (idempotence)
   - replay queued writes on reconnect/app resume.
5. Concurrency/conflict model:
   - per-domain `serverVersion` (or `updatedAt` + monotonic revision)
   - if stale base version, client pulls latest and reapplies.
6. Restore events parity:
   - keep app-level events equivalent to `backup-restored`, `backup-saved`, `backup-error`.

Domain coverage requirement:

- Include sleep domain in cloud payload for first time (currently local-only despite backup trigger).

---

## 6) Private file storage on Convex

Target model:

- Store avatar binaries in Convex file storage.
- Keep metadata in `user_files` plus pointer on `profiles.avatarFileId`.
- Do not use public world-readable buckets.

Read flow:

1. Authenticated user requests avatar URL.
2. Server checks access (owner or allowed public profile projection policy).
3. Server returns short-lived signed URL (or streams through authenticated HTTP action).

Write flow:

1. Client requests upload grant after auth check.
2. Uploads file.
3. Mutation records metadata and updates profile pointer.
4. Previous avatar marked replaced or scheduled for cleanup.

Migration:

- Export Supabase `avatars` objects.
- Import into Convex storage.
- Preserve mapping old path -> new `storageId`.

---

## 7) Reproducible migration script design (Supabase export -> Convex import)

Script family (proposed):

- `scripts/migrations/supabase/export.ts`
- `scripts/migrations/supabase/import-convex.ts`
- `scripts/migrations/supabase/verify.ts`
- `scripts/migrations/supabase/reconcile.ts` (optional)

## 7.1 Export step

- Inputs: Supabase project URL + service role key (runtime env only), run id.
- Export:
  - `profiles`, `workouts`, `nutrition`, `checkins`, `aliments`, `activities`, `ai_usage_limits`, `user_backups`
  - auth user metadata required for identity mapping
  - storage object manifest for avatars
- Output: immutable NDJSON/JSON files with checksums.

## 7.2 Import step

- Inputs: export bundle + Convex admin credentials + run id.
- Import behavior:
  - Upsert by deterministic natural keys (`userId`, `dateKey`, etc.).
  - Store per-entity mappings in `migration_entity_map`.
  - Preserve Supabase UUID in `legacySupabaseId` fields where applicable.
- Never delete during import.

## 7.3 Verification step

- Compare counts per entity before/after.
- Compare optional aggregate checksums by user/domain.
- Emit machine-readable report:
  - `ok`, `mismatches`, `warnings`.

## 7.4 Idempotence requirements

- Running import multiple times with same run id must be no-op updates.
- Running import with new run id must not duplicate logical rows.
- `clientMutationId` or deterministic upsert keys required on all writes.

---

## 8) Phased implementation order (small PRs/commits for Grok 4.6 High)

Legend:

- `GROK`: good candidate for Grok 4.6 High implementation.
- `CODEX-RISK`: security or migration-critical; Codex should implement/review directly.

1. PR-A (already this mission): plan + inventory docs only. (`CODEX-RISK`)
2. PR-B: add backend abstraction layer interfaces (no behavior change). (`GROK`)
3. PR-C: bootstrap Convex project wiring + feature flags + env plumbing. (`GROK`)
4. PR-D: Convex schema (core collections + indexes + generated types). (`CODEX-RISK`)
5. PR-E: auth/session/reset/deletion migration behind feature flag. (`CODEX-RISK`)
6. PR-F: migrate profile/train/nutrition/hydration/sleep/streak services to Convex read/write. (`GROK` with Codex review)
7. PR-G: migrate checkins/feed/stats RPC equivalents. (`CODEX-RISK`)
8. PR-H: private avatar file storage migration path. (`CODEX-RISK`)
9. PR-I: migration scripts (export/import/verify/idempotence checks). (`CODEX-RISK`)
10. PR-J: dual-write validation window + instrumentation dashboards. (`GROK`)
11. PR-K: switch normal operation to Convex-only reads/writes; keep Supabase rollback switch. (`CODEX-RISK`)
12. PR-L: remove active Supabase dependency only after Evan iPhone signoff. (`CODEX-RISK`)

---

## 9) Test plan (must pass before cutover)

## 9.1 Automated gates (per PR where relevant)

- `npm run lint`
- `npm run test` (plus targeted new tests for touched domains)
- `npm run build`
- `git diff --check`

## 9.2 Security/isolation matrix (minimum)

- Create user A and user B.
- Verify A cannot read/write any B-owned docs across every user collection.
- Verify feed output exposes only intended public/sanitized data.
- Verify file URL access control (A cannot fetch B private file directly).

## 9.3 Migration/idempotence matrix

- Dry-run export from Supabase.
- Import run #1 into empty Convex dataset.
- Re-import same dataset (run #2) and verify:
  - no duplicates
  - stable counts
  - deterministic mapping.
- Per-table record counts must match migration report thresholds.

## 9.4 Backup/resume/offline matrix

- Device/browser with empty local cache logs in: remote restores first.
- Offline edits queued locally, then replay on reconnect.
- App reload/mid-sync interruption resumes safely.
- No overwrite of remote by blank local on first login.

## 9.5 Auth matrix

- Login, logout, token refresh/session persistence.
- Password reset email flow (web + native/deep-link cases).
- Change password and account deletion.
- If hash migration unavailable, validate forced-reset rollout.

## 9.6 Platform notes (Vite/Capacitor/iOS/Android)

- Web (Vite): auth + sync + avatar upload + feed + stats.
- Capacitor iOS:
  - secure storage session persistence
  - password reset deep link
  - iPhone validation is final cutover gate.
- Capacitor Android:
  - same as iOS plus background/foreground sync behavior.

---

## 10) Env vars needed for Convex (names only)

Client/runtime:

- `VITE_CONVEX_URL`
- `VITE_ENABLE_CONVEX_PRIMARY`
- `VITE_PUBLIC_APP_URL`

Convex/auth/backend:

- `CONVEX_DEPLOYMENT`
- `CONVEX_DEPLOY_KEY`
- `CONVEX_AUTH_SECRET`
- `CONVEX_AUTH_EMAIL_FROM`
- `CONVEX_AUTH_RESET_REDIRECT_URL`
- `CONVEX_AUTH_RESET_TOKEN_TTL_MIN`
- `CONVEX_FILE_SIGNED_URL_TTL_SEC`

Migration scripts runtime:

- `MIGRATION_SUPABASE_URL`
- `MIGRATION_SUPABASE_SERVICE_ROLE_KEY`
- `MIGRATION_CONVEX_URL`
- `MIGRATION_CONVEX_ADMIN_KEY`
- `MIGRATION_RUN_ID`

---

## 11) Rollback plan while Supabase remains available

Rollback principles:

- Never delete Supabase data during migration window.
- Keep Supabase schema + storage as rollback source of truth until explicit approval.
- Keep feature flag for backend source selection.

Rollback-ready operating mode:

1. During validation window, optionally dual-write critical domains (Convex primary, Supabase mirror).
2. Keep exporter/importer available for reconciliation.
3. If severe issue after Convex cutover:
   - switch read/write flag back to Supabase build config
   - rehydrate local from Supabase on next login
   - investigate Convex state offline.

Rollback exit criteria:

- Evan approves final cutover after iPhone validation.
- Migration reports clean, isolation tests pass, auth/reset pass, backup/sync pass.

---

## Open questions requiring Evan decision

1. ~~Auth migration policy if password hashes are incompatible~~ **Locked:** global password reset for all users; no legacy password bridge.
2. Convex auth setup in shared environment:
   - if Convex CLI/browser login is required, Evan must authenticate in the shared browser.
   - no secrets/passwords should be requested in chat.
