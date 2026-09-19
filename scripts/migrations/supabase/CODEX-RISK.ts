/**
 * CODEX-RISK — PR-I delivered.
 *
 * Migration scripts now live in this folder:
 * - export.mjs
 * - import-convex.mjs
 * - verify.mjs
 * - dry-run.mjs (fake-data safety path)
 *
 * Runtime env names only (never commit values):
 * MIGRATION_SUPABASE_URL, MIGRATION_SUPABASE_SERVICE_ROLE_KEY,
 * MIGRATION_CONVEX_URL, MIGRATION_CONVEX_ADMIN_KEY, MIGRATION_ADMIN_SECRET,
 * MIGRATION_RUN_SECRET (optional), MIGRATION_RUN_ID
 */
export const CODEX_RISK_MIGRATION_SCRIPTS_PENDING = false
