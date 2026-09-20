import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
// @ts-ignore TS cannot infer named exports from runtime .mjs script module.
import * as migrationCoreMod from '../../scripts/migrations/supabase/core.mjs'
const migrationCore = migrationCoreMod as any

async function loadFixtureBundle() {
  const fixturePath = path.resolve(
    process.cwd(),
    'scripts/migrations/fixtures/sample-export.json',
  )
  const raw = await readFile(fixturePath, 'utf8')
  return migrationCore.normalizeExportBundle(JSON.parse(raw))
}

describe('supabase -> convex migration scripts', () => {
  it('maps fixture export rows into deterministic import rows', async () => {
    const bundle = await loadFixtureBundle()
    const rows = migrationCore.buildImportRows(bundle) as Array<{ entityType: string; checksum: string }>
    const counts = migrationCore.countBundleEntities(bundle) as Record<string, number>

    expect(rows.length).toBe(
      Object.values(counts).reduce((sum: number, value: number) => sum + Number(value), 0),
    )
    expect(rows[0]?.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(rows.some((row: { entityType: string }) => row.entityType === 'profiles')).toBe(true)
    expect(rows.some((row: { entityType: string }) => row.entityType === 'activities')).toBe(true)
  })

  it('is idempotent when re-importing the same bundle', async () => {
    const bundle = await loadFixtureBundle()
    const rows = migrationCore.buildImportRows(bundle)
    const target = migrationCore.createInMemoryImportTarget()

    const first = await migrationCore.applyImportRows(target, rows)
    expect(first.stats.inserted).toBe(rows.length)
    expect(first.stats.updated).toBe(0)
    expect(first.stats.skipped).toBe(0)

    const second = await migrationCore.applyImportRows(target, rows)
    expect(second.stats.inserted).toBe(0)
    expect(second.stats.updated).toBe(0)
    expect(second.stats.skipped).toBe(rows.length)

    const expectedCounts = migrationCore.countBundleEntities(bundle)
    const verification = migrationCore.verifyCounts(expectedCounts, second.counts?.mappedEntities)
    expect(verification.ok).toBe(true)
  })

  it('updates changed rows without creating duplicates', async () => {
    const bundle = await loadFixtureBundle()
    const rows = migrationCore.buildImportRows(bundle) as Array<{
      entityType: string
      supabaseId: string
      payload: Record<string, unknown>
      checksum: string
    }>
    const target = migrationCore.createInMemoryImportTarget()
    await migrationCore.applyImportRows(target, rows)

    const changed = [...rows]
    const idx = changed.findIndex(
      (row) => row.entityType === 'profiles' && row.supabaseId === 'user-a',
    )
    expect(idx).toBeGreaterThanOrEqual(0)

    const row = changed[idx]
    const nextPayload = {
      ...row.payload,
      level: 9,
    }
    changed[idx] = {
      ...row,
      payload: nextPayload,
      checksum: 'updated-checksum-profiles-user-a',
    }

    const result = await migrationCore.applyImportRows(target, changed)
    expect(result.stats.inserted).toBe(0)
    expect(result.stats.updated).toBe(1)
    expect(result.stats.skipped).toBe(changed.length - 1)

    const counts = target.getCounts()
    const verification = migrationCore.verifyCounts(
      migrationCore.countBundleEntities(bundle),
      counts.mappedEntities,
    )
    expect(verification.ok).toBe(true)
  })

  it('requires a server-only admin secret name for Convex import clients', () => {
    expect(migrationCore.MIGRATION_ENV_NAMES.adminSecret).toBe('MIGRATION_ADMIN_SECRET')
    expect(migrationCore.MIGRATION_ENV_NAMES.runSecret).toBe('MIGRATION_RUN_SECRET')
    expect(migrationCore.MIGRATION_ENV_NAMES.convexAdminKey).toBe('MIGRATION_CONVEX_ADMIN_KEY')
    const previous = process.env.MIGRATION_ADMIN_SECRET
    delete process.env.MIGRATION_ADMIN_SECRET
    try {
      expect(() => migrationCore.requireMigrationSecrets()).toThrow(/MIGRATION_ADMIN_SECRET/)
    } finally {
      if (previous === undefined) delete process.env.MIGRATION_ADMIN_SECRET
      else process.env.MIGRATION_ADMIN_SECRET = previous
    }
  })
})
