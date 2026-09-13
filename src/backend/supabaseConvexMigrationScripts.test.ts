import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyImportRows,
  buildImportRows,
  countBundleEntities,
  createInMemoryImportTarget,
  normalizeExportBundle,
  verifyCounts,
} from '../../scripts/migrations/supabase/core.mjs'

async function loadFixtureBundle() {
  const fixturePath = path.resolve(
    process.cwd(),
    'scripts/migrations/fixtures/sample-export.json',
  )
  const raw = await readFile(fixturePath, 'utf8')
  return normalizeExportBundle(JSON.parse(raw))
}

describe('supabase -> convex migration scripts', () => {
  it('maps fixture export rows into deterministic import rows', async () => {
    const bundle = await loadFixtureBundle()
    const rows = buildImportRows(bundle)
    const counts = countBundleEntities(bundle)

    expect(rows.length).toBe(
      Object.values(counts).reduce((sum, value) => sum + Number(value), 0),
    )
    expect(rows[0]?.checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(rows.some((row) => row.entityType === 'profiles')).toBe(true)
    expect(rows.some((row) => row.entityType === 'activities')).toBe(true)
  })

  it('is idempotent when re-importing the same bundle', async () => {
    const bundle = await loadFixtureBundle()
    const rows = buildImportRows(bundle)
    const target = createInMemoryImportTarget()

    const first = await applyImportRows(target, rows)
    expect(first.stats.inserted).toBe(rows.length)
    expect(first.stats.updated).toBe(0)
    expect(first.stats.skipped).toBe(0)

    const second = await applyImportRows(target, rows)
    expect(second.stats.inserted).toBe(0)
    expect(second.stats.updated).toBe(0)
    expect(second.stats.skipped).toBe(rows.length)

    const expectedCounts = countBundleEntities(bundle)
    const verification = verifyCounts(expectedCounts, second.counts?.mappedEntities)
    expect(verification.ok).toBe(true)
  })

  it('updates changed rows without creating duplicates', async () => {
    const bundle = await loadFixtureBundle()
    const rows = buildImportRows(bundle)
    const target = createInMemoryImportTarget()
    await applyImportRows(target, rows)

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

    const result = await applyImportRows(target, changed)
    expect(result.stats.inserted).toBe(0)
    expect(result.stats.updated).toBe(1)
    expect(result.stats.skipped).toBe(changed.length - 1)

    const counts = target.getCounts()
    const verification = verifyCounts(countBundleEntities(bundle), counts.mappedEntities)
    expect(verification.ok).toBe(true)
  })
})
