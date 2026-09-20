declare module '../../scripts/migrations/supabase/core.mjs' {
  export type ImportRow = {
    entityType: string
    supabaseId: string
    payload: Record<string, unknown>
    checksum: string
  }

  export function normalizeExportBundle(raw: unknown): {
    runId: string
    exportedAt: string
    source: { mode: 'live' | 'fake'; supabaseUrl: string | null }
    entities: Record<string, unknown[]>
  }

  export function countBundleEntities(bundle: unknown): Record<string, number>
  export function buildImportRows(bundle: unknown): ImportRow[]
  export function createInMemoryImportTarget(): {
    upsertImportRow(row: ImportRow): Promise<{ operation: 'inserted' | 'updated' | 'skipped'; convexId: string }>
    getCounts(): { mappedEntities: Record<string, number>; tables: Record<string, number> }
  }
  export function applyImportRows(
    target: {
      upsertImportRow(row: ImportRow): Promise<{ operation: 'inserted' | 'updated' | 'skipped'; convexId: string }>
      getCounts?: () => { mappedEntities: Record<string, number>; tables: Record<string, number> }
    },
    rows: ImportRow[],
    options?: { dryRun?: boolean },
  ): Promise<{
    stats: {
      inserted: number
      updated: number
      skipped: number
      dryRun: boolean
      processed: number
    }
    counts: { mappedEntities: Record<string, number>; tables: Record<string, number> } | null
    idMap: Record<string, string | null>
  }>
  export function verifyCounts(
    expectedCounts: Record<string, number>,
    actualCounts?: Record<string, number> | null,
  ): { ok: boolean; mismatches: Array<{ entityType: string; expected: number; actual: number }> }
}
