import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
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

function createRichBundle() {
  return migrationCore.normalizeExportBundle({
    runId: 'rich-run',
    exportedAt: '2026-09-27T12:00:00.000Z',
    source: { mode: 'fake', supabaseUrl: 'https://example.supabase.co' },
    entities: {
      auth_users: [],
      profiles: [
        {
          id: 'user-rich',
          pseudo: 'Rich',
          level: 7,
          xp: 1500,
          rank: 'Gold',
          discipline: 'Crossfit',
          is_ghost_mode_enabled: false,
          current_streak: 11,
          last_login_date: '2026-09-26',
          custom_spots: [
            { id: 'spot-1', name: 'Spot 1', lat: 48.86, lng: 2.35 },
            { id: 'spot-2', name: 'Spot 2', lat: 48.87, lng: 2.36 },
          ],
          active_checkin: { gym: { id: 'gym-a', name: 'Gym A' } },
          created_at: '2026-09-01T09:00:00.000Z',
          updated_at: '2026-09-27T10:00:00.000Z',
        },
      ],
      workouts: [],
      nutrition: [
        {
          user_id: 'user-rich',
          profile: { onboardingComplete: true },
          journal: {
            '2026-09-26': {
              meals: [
                {
                  id: 'meal-1',
                  mealType: 'lunch',
                  name: 'Poulet',
                  calories: 450,
                  proteinG: 40,
                  carbsG: 25,
                  fatG: 12,
                  grams: 220,
                  portionMode: 'solo',
                  createdAt: 1_790_000_000_000,
                },
              ],
              waterEntries: [
                {
                  id: 'water-1',
                  amountMl: 350,
                  type: 'glass',
                  label: 'Verre',
                  createdAt: 1_790_000_100_000,
                },
              ],
              waterBottleLevelMl: 700,
              waterBottleCalibrationTotalMl: 1200,
            },
          },
          updated_at: '2026-09-27T10:00:00.000Z',
        },
      ],
      checkins: [],
      aliments: [
        {
          id: 'food-1',
          user_id: 'user-rich',
          nom: 'Skyr',
          calories: 63,
          proteines: 11,
          glucides: 4,
          lipides: 0.2,
          barcode: '3274080005003',
          created_at: '2026-09-27T10:00:00.000Z',
        },
      ],
      activities: [],
      ai_usage_limits: [],
      user_backups: [],
    },
  })
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

  it('maps streak/lobby/nutrition-derived/catalog payloads for server-side import', () => {
    const bundle = createRichBundle()
    const rows = migrationCore.buildImportRows(bundle) as Array<{
      entityType: string
      payload: Record<string, unknown>
    }>

    const profile = rows.find((row) => row.entityType === 'profiles')
    const nutrition = rows.find((row) => row.entityType === 'nutrition')
    const aliment = rows.find((row) => row.entityType === 'aliments')
    expect(profile?.payload.currentStreak).toBe(11)
    expect(profile?.payload.lastLoginDate).toBe('2026-09-26')
    expect(Array.isArray(profile?.payload.customSpotsJson)).toBe(true)
    expect((profile?.payload.customSpotsJson as unknown[])?.length).toBe(2)
    expect(profile?.payload.activeCheckinJson).toBeTruthy()

    expect(Array.isArray(nutrition?.payload.normalizedMeals)).toBe(true)
    expect((nutrition?.payload.normalizedMeals as unknown[])?.length).toBe(1)
    expect(Array.isArray(nutrition?.payload.normalizedWaterEntries)).toBe(true)
    expect((nutrition?.payload.normalizedWaterEntries as unknown[])?.length).toBe(1)
    expect(Array.isArray(nutrition?.payload.normalizedDayStates)).toBe(true)
    expect((nutrition?.payload.normalizedDayStates as unknown[])?.length).toBe(1)

    expect((aliment?.payload.catalogRow as { foodKey: string }).foodKey).toBe(
      'barcode:3274080005003',
    )
  })

  it('derives and verifies expanded table counts including per-user derived counts', () => {
    const bundle = createRichBundle()
    const expected = migrationCore.deriveExpectedTableCounts(bundle)
    expect(expected.tables.streak_state).toBe(1)
    expect(expected.tables.custom_spots).toBe(2)
    expect(expected.tables.active_checkins).toBe(1)
    expect(expected.tables.nutrition_meals).toBe(1)
    expect(expected.tables.nutrition_water_entries).toBe(1)
    expect(expected.tables.nutrition_day_state).toBe(1)
    expect(expected.tables.nutrition_food_catalog).toBe(1)
    expect(expected.perUserDerivedTables.nutrition_meals['user-rich']).toBe(1)

    const tableVerification = migrationCore.verifyTableCounts(expected.tables, expected.tables)
    expect(tableVerification.ok).toBe(true)

    const perUserMismatch = migrationCore.verifyDerivedPerUserCounts(expected.perUserDerivedTables, {
      ...expected.perUserDerivedTables,
      nutrition_meals: { 'user-rich': 0 },
    })
    expect(perUserMismatch.ok).toBe(false)
    expect(perUserMismatch.mismatches[0]?.tableName).toBe('nutrition_meals')
  })

  it('enforces Node 22+ with a clear message', () => {
    expect(() => migrationCore.assertSupportedNodeVersion('unit-test', '22.0.0')).not.toThrow()
    expect(() => migrationCore.assertSupportedNodeVersion('unit-test', '21.10.0')).toThrow(
      /Node\.js 22\+/,
    )
  })

  it('writes migration artifacts with private filesystem permissions', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'migration-artifacts-'))
    try {
      const filePath = path.join(dir, 'report.json')
      await migrationCore.writePrivateJsonFile(filePath, { ok: true })

      const fileStats = await stat(filePath)
      expect(fileStats.mode & 0o777).toBe(0o600)

      const dirStats = await stat(dir)
      expect(dirStats.mode & 0o777).toBe(0o700)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('lists avatar storage objects through Supabase Storage API folders', async () => {
    const mod = (await import('../../scripts/migrations/supabase/avatar-storage.mjs')) as {
      listSupabaseAvatarObjects: (supabase: unknown) => Promise<
        Array<{ userId: string | null; path: string }>
      >
    }
    const directory: Record<string, Array<Record<string, unknown>>> = {
      '': [{ id: null, name: 'user-a' }, { id: null, name: 'user-b' }],
      'user-a': [
        {
          id: 'obj-a',
          name: 'avatar.jpg',
          metadata: { mimetype: 'image/jpeg', size: 120_000 },
          created_at: '2026-09-20T10:00:00.000Z',
          updated_at: '2026-09-20T10:00:00.000Z',
        },
      ],
      'user-b': [
        { id: null, name: 'nested' },
        {
          id: 'obj-b',
          name: 'profile.png',
          metadata: { mimetype: 'image/png', size: 80_000 },
          created_at: '2026-09-21T10:00:00.000Z',
          updated_at: '2026-09-21T10:00:00.000Z',
        },
      ],
      'user-b/nested': [
        {
          id: 'obj-c',
          name: 'avatar.webp',
          metadata: { mimetype: 'image/webp', size: 64_000 },
          created_at: '2026-09-22T10:00:00.000Z',
          updated_at: '2026-09-22T10:00:00.000Z',
        },
      ],
    }
    const fakeSupabase = {
      storage: {
        from(bucket: string) {
          expect(bucket).toBe('avatars')
          return {
            list(folder: string) {
              return Promise.resolve({
                data: directory[folder] ?? [],
                error: null,
              })
            },
          }
        },
      },
    }

    const rows = await mod.listSupabaseAvatarObjects(fakeSupabase)
    expect(rows.map((row) => row.path)).toEqual([
      'user-a/avatar.jpg',
      'user-b/nested/avatar.webp',
      'user-b/profile.png',
    ])
    expect(rows.map((row) => row.userId)).toEqual(['user-a', 'user-b', 'user-b'])
  })

  it('honors --run-id for real import reports (fake-data dry-run)', async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), 'migration-runid-'))
    try {
      const runId = 'cli-run-id-override'
      const result = spawnSync(
        'node',
        [
          'scripts/migrations/supabase/import-convex.mjs',
          '--fake-data',
          '--dry-run',
          '--run-id',
          runId,
          '--out-dir',
          outDir,
        ],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
        },
      )
      expect(result.status).toBe(0)
      const output = JSON.parse(result.stdout.trim()) as { runId: string; reportPath: string }
      expect(output.runId).toBe(runId)
      const reportRaw = await readFile(output.reportPath, 'utf8')
      const report = JSON.parse(reportRaw) as { runId: string }
      expect(report.runId).toBe(runId)
    } finally {
      await rm(outDir, { recursive: true, force: true })
    }
  })
})
