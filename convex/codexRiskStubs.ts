/**
 * CODEX-RISK progress tracker.
 *
 * Landed in this wave:
 * - PR-G: checkins/feed/stats + ai usage RPC equivalents (`convex/rpc.ts`)
 * - PR-I: migration scripts (`scripts/migrations/supabase/*`)
 *
 * Remaining CODEX-RISK scope:
 * - PR-H: Supabase avatar binary export/import and signed URL TTL cleanup.
 */
export const CODEX_RISK_STATUS = {
  completed: ['PR-G', 'PR-I'],
  remaining: {
    prH: 'avatar binary migration + signed URL TTL + cleanup',
  },
} as const
