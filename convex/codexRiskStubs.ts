/**
 * CODEX-RISK — not implemented in this wave (PR-F).
 *
 * Next waves owned by Codex review:
 * - PR-G: checkins history + social feed + stats RPC equivalents
 *   (`get_social_activity_feed`, `record_activity`, `get_user_stats`,
 *   `reserve_ai_meal_scan` / `release_ai_meal_scan`).
 * - PR-I: migration scripts (export / import-convex / verify / reconcile).
 * - PR-H remainder: Supabase avatars export → Convex storage import,
 *   short-lived HTTP signed URLs (`CONVEX_FILE_SIGNED_URL_TTL_SEC`),
 *   replaced-file cleanup.
 *
 * Do not call these placeholders from the React app. Supabase remains
 * the runtime for these RPCs until that wave.
 */
export const CODEX_RISK_NEXT_WAVES = {
  prG: 'checkins/feed/stats RPC equivalents',
  prH: 'avatar binary migration + signed URL TTL + cleanup',
  prI: 'migration export/import/verify scripts',
} as const
