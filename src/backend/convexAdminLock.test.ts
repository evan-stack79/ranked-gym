import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  getPasswordResetOutboxPreviewForAdmin,
  importUsersWithoutPasswords,
  importUsersWithoutPasswordsForAdmin,
  queueGlobalPasswordResetCampaign,
  queueGlobalPasswordResetCampaignForAdmin,
  getPasswordResetOutboxPreview,
} from '../../convex/auth'
import {
  generateMigrationAvatarUploadUrl,
  generateMigrationAvatarUploadUrlForRun,
  importSupabaseAvatar,
  importSupabaseAvatarForUser,
} from '../../convex/files'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  finishRun,
  finishRunForAdmin,
  getCounts,
  getCountsForAdmin,
  importEntity,
  importEntityForRun,
  startRun,
  startRunForAdmin,
} from '../../convex/migrations'

const ADMIN_SECRET = 'unit-test-admin-secret'
const RUN_SECRET = 'unit-test-run-secret'
const SOURCE_SHA = 'sha-lock-1'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'auth_password_reset_outbox'
  | 'auth_password_reset_tokens'
  | 'profiles'
  | 'workouts_state'
  | 'nutrition_state'
  | 'nutrition_meals'
  | 'nutrition_water_entries'
  | 'nutrition_day_state'
  | 'nutrition_food_catalog'
  | 'checkins'
  | 'custom_spots'
  | 'active_checkins'
  | 'aliments'
  | 'activities'
  | 'ai_usage_limits'
  | 'streak_state'
  | 'legacy_supabase_backups'
  | 'user_files'
  | 'migration_runs'
  | 'migration_entity_map'
  | 'rate_limit_buckets'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    auth_password_reset_outbox: [],
    auth_password_reset_tokens: [],
    profiles: [],
    workouts_state: [],
    nutrition_state: [],
    nutrition_meals: [],
    nutrition_water_entries: [],
    nutrition_day_state: [],
    nutrition_food_catalog: [],
    checkins: [],
    custom_spots: [],
    active_checkins: [],
    aliments: [],
    activities: [],
    ai_usage_limits: [],
    streak_state: [],
    legacy_supabase_backups: [],
    user_files: [],
    migration_runs: [],
    migration_entity_map: [],
    rate_limit_buckets: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  get(id: string) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (row) return Promise.resolve(row)
    }
    return Promise.resolve(null)
  }

  patch(id: string, patch: Record<string, unknown>) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((candidate) => candidate._id === id)
      if (!row) continue
      Object.assign(row, patch)
      return Promise.resolve()
    }
    throw new Error(`Row not found: ${id}`)
  }

  table(name: TableName): StoredRow[] {
    return this.rows[name]
  }
}

class FakeQuery {
  private filtered: StoredRow[]

  constructor(rows: StoredRow[]) {
    this.filtered = [...rows]
  }

  withIndex(
    _indexName: string,
    fn?: (q: {
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => unknown
      }
    }) => unknown,
  ) {
    if (!fn) return this
    const clauses: Array<{ field: string; value: unknown }> = []
    const chain = {
      eq(field: string, value: unknown) {
        clauses.push({ field, value })
        return chain
      },
    }
    fn(chain)
    this.filtered = this.filtered.filter((row) =>
      clauses.every((clause) => row[clause.field] === clause.value),
    )
    return this
  }

  order(direction: 'asc' | 'desc') {
    if (direction === 'desc') this.filtered.reverse()
    return this
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }

  take(limit: number) {
    return Promise.resolve(this.filtered.slice(0, limit))
  }
}

class FakeStorage {
  generateUploadUrl() {
    return Promise.resolve('https://upload.example/migration')
  }
}

function createCtx(db: FakeDb, storage = new FakeStorage()) {
  return { db, storage }
}

type MigrationScopeFixture = {
  migratedUserIds: string[]
  entitySupabaseIds: Record<string, string[]>
  customSpotKeys: string[]
  activeCheckinUserIds: string[]
  mealKeys: string[]
  waterEntryKeys: string[]
  dayStateKeys: string[]
  foodCatalogKeys: string[]
}

function buildScope(overrides: Partial<MigrationScopeFixture> = {}): MigrationScopeFixture {
  return {
    migratedUserIds: [],
    entitySupabaseIds: {
      auth_users: [],
      profiles: [],
      workouts: [],
      nutrition: [],
      checkins: [],
      aliments: [],
      activities: [],
      ai_usage_limits: [],
      user_backups: [],
    },
    customSpotKeys: [],
    activeCheckinUserIds: [],
    mealKeys: [],
    waterEntryKeys: [],
    dayStateKeys: [],
    foodCatalogKeys: [],
    ...overrides,
  }
}

async function seedSession(
  db: FakeDb,
  userId: string,
  sessionToken: string,
  role?: 'admin' | 'user',
) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId,
    email: `${userId}@example.com`,
    emailNorm: `${userId}@example.com`,
    displayName: userId,
    mustResetPassword: false,
    role,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + 120_000,
  })
}

describe('Convex admin/migration endpoint lock (C1-C3)', () => {
  const previousSecret = process.env.MIGRATION_ADMIN_SECRET

  beforeEach(() => {
    process.env.MIGRATION_ADMIN_SECRET = ADMIN_SECRET
  })

  afterEach(() => {
    if (previousSecret === undefined) delete process.env.MIGRATION_ADMIN_SECRET
    else process.env.MIGRATION_ADMIN_SECRET = previousSecret
  })

  it('exposes migration/auth admin functions as internal-only', () => {
    expect(startRun.isInternal).toBe(true)
    expect(importEntity.isInternal).toBe(true)
    expect(finishRun.isInternal).toBe(true)
    expect(getCounts.isInternal).toBe(true)
    expect(generateMigrationAvatarUploadUrl.isInternal).toBe(true)
    expect(importSupabaseAvatar.isInternal).toBe(true)
    expect(importUsersWithoutPasswords.isInternal).toBe(true)
    expect(queueGlobalPasswordResetCampaign.isInternal).toBe(true)
    expect(getPasswordResetOutboxPreview.isInternal).toBe(true)
  })

  it('refuses unauthenticated migration and auth admin calls', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    await expect(
      startRunForAdmin(ctx as never, {
        runId: 'run-1',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
      }),
    ).rejects.toThrow(/Not authenticated/)

    await expect(
      importEntityForRun(ctx as never, {
        runId: 'run-1',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        entityType: 'profiles',
        supabaseId: 'user-a',
        checksum: 'abc',
        payload: { userId: 'user-a' },
      }),
    ).rejects.toThrow(/Not authenticated/)

    await expect(
      importUsersWithoutPasswordsForAdmin(ctx as never, {
        users: [{ email: 'a@example.com' }],
      }),
    ).rejects.toThrow(/Not authenticated/)

    await expect(
      queueGlobalPasswordResetCampaignForAdmin(ctx as never, {}),
    ).rejects.toThrow(/Not authenticated/)

    await expect(getPasswordResetOutboxPreviewForAdmin(ctx as never, {})).rejects.toThrow(
      /Not authenticated/,
    )
  })

  it('refuses a standard user session for migration and auth admin calls', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedSession(db, 'user-standard', 'session-standard', 'user')

    await expect(
      startRunForAdmin(ctx as never, {
        runId: 'run-1',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        sessionToken: 'session-standard',
      }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)

    await expect(
      importUsersWithoutPasswordsForAdmin(ctx as never, {
        users: [{ email: 'a@example.com' }],
        sessionToken: 'session-standard',
      }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)

    await expect(
      getCountsForAdmin(ctx as never, { sessionToken: 'session-standard' }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)
  })

  it('allows the admin-secret path to start and import a run', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    const started = await startRunForAdmin(ctx as never, {
      runId: 'run-admin-secret',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    expect(started.created).toBe(true)
    expect(db.table('migration_runs')[0]?.adminSecretHash).toBe(await hashToken(RUN_SECRET))

    const imported = await importEntityForRun(ctx as never, {
      runId: 'run-admin-secret',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-a',
      checksum: 'checksum-1',
      payload: { userId: 'user-a', pseudo: 'A', level: 2, xp: 10, rank: 'Bronze' },
    })
    expect(imported.operation).toBe('inserted')
    expect(imported.convexId).toBeTruthy()
  })

  it('keeps original mapping runId when a row is skipped on a later run', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    await startRunForAdmin(ctx as never, {
      runId: 'run-first',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    await importEntityForRun(ctx as never, {
      runId: 'run-first',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-skip',
      checksum: 'checksum-skip',
      payload: { userId: 'user-skip', pseudo: 'Skip', level: 1, xp: 0, rank: 'Bronze' },
    })
    const before = db.table('migration_entity_map')[0]
    expect(before.runId).toBe('run-first')

    await startRunForAdmin(ctx as never, {
      runId: 'run-second',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    const skipped = await importEntityForRun(ctx as never, {
      runId: 'run-second',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-skip',
      checksum: 'checksum-skip',
      payload: { userId: 'user-skip', pseudo: 'Skip', level: 1, xp: 0, rank: 'Bronze' },
    })
    expect(skipped.operation).toBe('skipped')

    const after = db.table('migration_entity_map')[0]
    expect(after.runId).toBe('run-first')
  })

  it('scopes verify counts by source ids so skipped re-imports still verify on later runs', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    await startRunForAdmin(ctx as never, {
      runId: 'run-a',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    await importEntityForRun(ctx as never, {
      runId: 'run-a',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-scope',
      checksum: 'checksum-scope-1',
      payload: { userId: 'user-scope', pseudo: 'Scoped', level: 1, xp: 0, rank: 'Bronze' },
    })

    await startRunForAdmin(ctx as never, {
      runId: 'run-b',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    const skipped = await importEntityForRun(ctx as never, {
      runId: 'run-b',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-scope',
      checksum: 'checksum-scope-1',
      payload: { userId: 'user-scope', pseudo: 'Scoped', level: 1, xp: 0, rank: 'Bronze' },
    })
    expect(skipped.operation).toBe('skipped')

    const scopedCounts = await getCountsForAdmin(ctx as never, {
      runId: 'run-b',
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      scope: buildScope({
        migratedUserIds: ['user-scope'],
        entitySupabaseIds: { ...buildScope().entitySupabaseIds, profiles: ['user-scope'] },
      }),
    })
    expect(scopedCounts.mappedEntities.profiles).toBe(1)
    expect(scopedCounts.tables.profiles).toBe(1)
  })

  it('upserts streak/lobby/nutrition-derived/catalog tables without duplicates on re-import', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await startRunForAdmin(ctx as never, {
      runId: 'run-derived',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-derived',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-derived',
      checksum: 'profile-checksum-1',
      payload: {
        userId: 'user-derived',
        pseudo: 'Derived',
        level: 3,
        xp: 120,
        rank: 'Silver',
        currentStreak: 6,
        lastLoginDate: '2026-09-27',
        customSpotsJson: [
          { id: 'spot-1', name: 'One', lat: 1, lng: 1 },
          { id: 'spot-2', name: 'Two', lat: 2, lng: 2 },
        ],
        activeCheckinJson: { gym: { id: 'gym-1' } },
      },
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-derived',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'nutrition',
      supabaseId: 'user-derived',
      checksum: 'nutrition-checksum-1',
      payload: {
        userId: 'user-derived',
        profileJson: {},
        journalJson: {},
        normalizedMeals: [
          {
            mealId: 'meal-1',
            dateKey: '2026-09-27',
            mealType: 'lunch',
            name: 'Meal',
            calories: 500,
            createdAt: 1,
            updatedAt: 1,
            schemaVersion: 1,
          },
        ],
        normalizedWaterEntries: [
          {
            entryId: 'water-1',
            dateKey: '2026-09-27',
            amountMl: 300,
            type: 'glass',
            label: 'Verre',
            createdAt: 1,
            updatedAt: 1,
            schemaVersion: 1,
          },
        ],
        normalizedDayStates: [
          {
            dateKey: '2026-09-27',
            waterBottleLevelMl: 700,
            waterBottleCalibrationTotalMl: 1200,
            updatedAt: 1,
            schemaVersion: 1,
          },
        ],
      },
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-derived',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'aliments',
      supabaseId: 'food-derived',
      checksum: 'aliment-checksum-1',
      payload: {
        userId: 'user-derived',
        nom: 'Skyr',
        calories: 63,
        proteines: 11,
        glucides: 4,
        lipides: 1,
        barcode: '3274080005003',
        createdAt: 1,
      },
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-derived',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'nutrition',
      supabaseId: 'user-derived',
      checksum: 'nutrition-checksum-2',
      payload: {
        userId: 'user-derived',
        profileJson: {},
        journalJson: {},
        normalizedMeals: [
          {
            mealId: 'meal-1',
            dateKey: '2026-09-27',
            mealType: 'lunch',
            name: 'Meal updated',
            calories: 510,
            createdAt: 1,
            updatedAt: 2,
            schemaVersion: 1,
          },
        ],
        normalizedWaterEntries: [
          {
            entryId: 'water-1',
            dateKey: '2026-09-27',
            amountMl: 320,
            type: 'glass',
            label: 'Verre',
            createdAt: 1,
            updatedAt: 2,
            schemaVersion: 1,
          },
        ],
        normalizedDayStates: [
          {
            dateKey: '2026-09-27',
            waterBottleLevelMl: 750,
            waterBottleCalibrationTotalMl: 1200,
            updatedAt: 2,
            schemaVersion: 1,
          },
        ],
      },
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-derived',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'aliments',
      supabaseId: 'food-derived',
      checksum: 'aliment-checksum-2',
      payload: {
        userId: 'user-derived',
        nom: 'Skyr',
        calories: 64,
        proteines: 11,
        glucides: 4,
        lipides: 1,
        barcode: '3274080005003',
        createdAt: 1,
      },
    })

    expect(db.table('streak_state')).toHaveLength(1)
    expect(db.table('custom_spots')).toHaveLength(2)
    expect(db.table('active_checkins')).toHaveLength(1)
    expect(db.table('nutrition_meals')).toHaveLength(1)
    expect(db.table('nutrition_water_entries')).toHaveLength(1)
    expect(db.table('nutrition_day_state')).toHaveLength(1)
    expect(db.table('nutrition_food_catalog')).toHaveLength(1)
    expect(db.table('nutrition_meals')[0]?.name).toBe('Meal updated')
  })

  it('keeps existing derived rows on re-import without --prune', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await startRunForAdmin(ctx as never, {
      runId: 'run-prune-default',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-prune-default',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-prune',
      checksum: 'profile-prune-1',
      payload: {
        userId: 'user-prune',
        pseudo: 'Prune',
        customSpotsJson: [
          { id: 'spot-a', name: 'A', lat: 1, lng: 1 },
          { id: 'spot-b', name: 'B', lat: 2, lng: 2 },
        ],
        activeCheckinJson: { gym: { id: 'gym-a' } },
      },
    })
    await importEntityForRun(ctx as never, {
      runId: 'run-prune-default',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'nutrition',
      supabaseId: 'user-prune',
      checksum: 'nutrition-prune-1',
      payload: {
        userId: 'user-prune',
        profileJson: {},
        journalJson: {},
        normalizedMeals: [{ mealId: 'meal-a', dateKey: '2026-09-27', name: 'A', mealType: 'lunch' }],
        normalizedWaterEntries: [
          { entryId: 'water-a', dateKey: '2026-09-27', amountMl: 200, type: 'glass', label: 'Verre' },
        ],
        normalizedDayStates: [{ dateKey: '2026-09-27', waterBottleLevelMl: 500 }],
      },
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-prune-default',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'profiles',
      supabaseId: 'user-prune',
      checksum: 'profile-prune-2',
      payload: {
        userId: 'user-prune',
        pseudo: 'Prune',
        customSpotsJson: [{ id: 'spot-a', name: 'A', lat: 1, lng: 1 }],
        activeCheckinJson: null,
      },
    })
    await importEntityForRun(ctx as never, {
      runId: 'run-prune-default',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'nutrition',
      supabaseId: 'user-prune',
      checksum: 'nutrition-prune-2',
      payload: {
        userId: 'user-prune',
        profileJson: {},
        journalJson: {},
        normalizedMeals: [],
        normalizedWaterEntries: [],
        normalizedDayStates: [],
      },
    })

    expect(db.table('custom_spots')).toHaveLength(2)
    expect(db.table('active_checkins')).toHaveLength(1)
    expect(db.table('nutrition_meals')).toHaveLength(1)
    expect(db.table('nutrition_water_entries')).toHaveLength(1)
    expect(db.table('nutrition_day_state')).toHaveLength(1)
  })

  it('deduplicates food catalog by barcode and accumulates selectedCount across duplicates', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await startRunForAdmin(ctx as never, {
      runId: 'run-food-dup',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-food-dup',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'aliments',
      supabaseId: 'food-1',
      checksum: 'food-1',
      payload: {
        userId: 'user-food',
        nom: 'Skyr',
        calories: 63,
        proteines: 11,
        glucides: 4,
        lipides: 1,
        barcode: '3274080005003',
      },
    })
    await importEntityForRun(ctx as never, {
      runId: 'run-food-dup',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'aliments',
      supabaseId: 'food-2',
      checksum: 'food-2',
      payload: {
        userId: 'user-food',
        nom: 'Skyr duplicate',
        calories: 64,
        proteines: 11,
        glucides: 4,
        lipides: 1,
        barcode: '3274080005003',
      },
    })

    expect(db.table('nutrition_food_catalog')).toHaveLength(1)
    expect(db.table('nutrition_food_catalog')[0]?.selectedCount).toBe(2)

    const scopedCounts = await getCountsForAdmin(ctx as never, {
      adminSecret: ADMIN_SECRET,
      scope: buildScope({
        migratedUserIds: ['user-food'],
        entitySupabaseIds: { ...buildScope().entitySupabaseIds, aliments: ['food-1', 'food-2'] },
        foodCatalogKeys: ['user-food:barcode:3274080005003'],
      }),
    })
    expect(scopedCounts.tables.nutrition_food_catalog).toBe(1)
    expect(scopedCounts.metrics.nutrition_food_catalog_selected_count_total).toBe(2)
  })

  it('reports Convex accounts outside the bundle scope as non-blocking info', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await startRunForAdmin(ctx as never, {
      runId: 'run-non-bundle',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    await importEntityForRun(ctx as never, {
      runId: 'run-non-bundle',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'auth_users',
      supabaseId: 'user-bundle',
      checksum: 'auth-bundle',
      payload: { userId: 'user-bundle', email: 'bundle@example.com' },
    })
    await importEntityForRun(ctx as never, {
      runId: 'run-non-bundle',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'auth_users',
      supabaseId: 'user-extra',
      checksum: 'auth-extra',
      payload: { userId: 'user-extra', email: 'extra@example.com' },
    })

    const scopedCounts = await getCountsForAdmin(ctx as never, {
      adminSecret: ADMIN_SECRET,
      scope: buildScope({
        migratedUserIds: ['user-bundle'],
        entitySupabaseIds: { ...buildScope().entitySupabaseIds, auth_users: ['user-bundle'] },
      }),
    })
    expect(scopedCounts.tables.auth_users).toBe(1)
    expect(scopedCounts.nonBundleUsers.count).toBe(1)
    expect(scopedCounts.nonBundleUsers.userIds).toContain('user-extra')
  })

  it('merges run summaries instead of overwriting when finishing multiple phases', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await startRunForAdmin(ctx as never, {
      runId: 'run-summary-merge',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await finishRunForAdmin(ctx as never, {
      runId: 'run-summary-merge',
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      status: 'completed',
      summaryJson: { import: { inserted: 9 } },
    })
    await finishRunForAdmin(ctx as never, {
      runId: 'run-summary-merge',
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      status: 'completed',
      summaryJson: { avatarStorage: { imported: 2 } },
    })

    const run = db.table('migration_runs').find((row) => row.runId === 'run-summary-merge')
    const summary = (run?.summaryJson ?? {}) as Record<string, unknown>
    expect(summary.import).toBeTruthy()
    expect(summary.avatarStorage).toBeTruthy()
  })

  it('allows an explicit admin-role session path', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedSession(db, 'user-admin', 'session-admin', 'admin')

    const started = await startRunForAdmin(ctx as never, {
      runId: 'run-admin-session',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      sessionToken: 'session-admin',
    })
    expect(started.created).toBe(true)

    const importedUsers = await importUsersWithoutPasswordsForAdmin(ctx as never, {
      sessionToken: 'session-admin',
      users: [{ email: 'legacy@example.com', displayName: 'Legacy' }],
    })
    expect(importedUsers.imported).toBe(1)

    const queued = await queueGlobalPasswordResetCampaignForAdmin(ctx as never, {
      sessionToken: 'session-admin',
    })
    expect(queued.queued).toBe(1)

    const preview = await getPasswordResetOutboxPreviewForAdmin(ctx as never, {
      sessionToken: 'session-admin',
    })
    expect(preview).toHaveLength(1)
    expect(preview[0]?.email).toBe('legacy@example.com')
  })

  it('keeps mustResetPassword=false and existing hash on auth_users re-import', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const now = Date.now()
    await startRunForAdmin(ctx as never, {
      runId: 'run-auth-upsert',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await db.insert('auth_users', {
      userId: 'legacy-user',
      email: 'legacy@example.com',
      emailNorm: 'legacy@example.com',
      displayName: 'Legacy',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_password_credentials', {
      userId: 'legacy-user',
      passwordHash: 'pbkdf2$hash-before',
      updatedAt: now,
    })

    await importEntityForRun(ctx as never, {
      runId: 'run-auth-upsert',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
      entityType: 'auth_users',
      supabaseId: 'legacy-user',
      checksum: 'checksum-auth-upsert-1',
      payload: {
        userId: 'legacy-user',
        email: 'legacy@example.com',
        emailNorm: 'legacy@example.com',
        displayName: 'Legacy Updated',
        mustResetPassword: true,
      },
    })

    const user = db.table('auth_users')[0]
    expect(user.mustResetPassword).toBe(false)
    expect(user.displayName).toBe('Legacy Updated')
    expect(db.table('auth_password_credentials')[0]?.passwordHash).toBe('pbkdf2$hash-before')
  })

  it('cannot create or import a migration without the admin/run secret', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)

    await expect(
      startRunForAdmin(ctx as never, {
        runId: 'run-no-secret',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        adminSecret: 'wrong-admin-secret-xx',
      }),
    ).rejects.toThrow(/MIGRATION_ADMIN_FORBIDDEN/)

    await startRunForAdmin(ctx as never, {
      runId: 'run-real',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await expect(
      importEntityForRun(ctx as never, {
        runId: 'run-real',
        sourceSha: SOURCE_SHA,
        runSecret: 'invented-run-secret1',
        adminSecret: ADMIN_SECRET,
        entityType: 'profiles',
        supabaseId: 'user-a',
        checksum: 'checksum-1',
        payload: { userId: 'user-a' },
      }),
    ).rejects.toThrow(/MIGRATION_RUN_SECRET_INVALID/)

    await expect(
      importEntityForRun(ctx as never, {
        runId: 'invented-run-id',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        adminSecret: ADMIN_SECRET,
        entityType: 'profiles',
        supabaseId: 'user-a',
        checksum: 'checksum-1',
        payload: { userId: 'user-a' },
      }),
    ).rejects.toThrow(/MIGRATION_RUN_NOT_FOUND/)

    await expect(
      finishRunForAdmin(ctx as never, {
        runId: 'invented-run-id',
        runSecret: RUN_SECRET,
        adminSecret: ADMIN_SECRET,
        status: 'completed',
        summaryJson: {},
      }),
    ).rejects.toThrow(/MIGRATION_RUN_NOT_FOUND/)
  })

  it('refuses avatar migration when the runId is invented or the run secret is wrong', async () => {
    const db = new FakeDb()
    const storage = new FakeStorage()
    const ctx = createCtx(db, storage)
    await seedSession(db, 'user-a', 'session-a')

    await expect(
      generateMigrationAvatarUploadUrlForRun(ctx as never, {
        runId: 'invented-run',
        sourceSha: SOURCE_SHA,
        runSecret: RUN_SECRET,
        adminSecret: ADMIN_SECRET,
      }),
    ).rejects.toThrow(/MIGRATION_RUN_NOT_FOUND/)

    await startRunForAdmin(ctx as never, {
      runId: 'run-avatar',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })

    await expect(
      generateMigrationAvatarUploadUrlForRun(ctx as never, {
        runId: 'run-avatar',
        sourceSha: SOURCE_SHA,
        runSecret: 'wrong-run-secret-xx',
        adminSecret: ADMIN_SECRET,
      }),
    ).rejects.toThrow(/MIGRATION_RUN_SECRET_INVALID/)

    const upload = await generateMigrationAvatarUploadUrlForRun(ctx as never, {
      runId: 'run-avatar',
      sourceSha: SOURCE_SHA,
      runSecret: RUN_SECRET,
      adminSecret: ADMIN_SECRET,
    })
    expect(upload.uploadUrl).toContain('https://upload.example/')

    await expect(
      importSupabaseAvatarForUser(ctx as never, {
        runId: 'run-avatar',
        sourceSha: SOURCE_SHA,
        runSecret: 'wrong-run-secret-xx',
        adminSecret: ADMIN_SECRET,
        userId: 'user-a',
        legacySupabasePath: 'user-a/avatar.jpg',
        storageId: 'storage-1' as never,
        contentType: 'image/jpeg',
        sizeBytes: 10,
        sha256: 'abc',
      }),
    ).rejects.toThrow(/MIGRATION_RUN_SECRET_INVALID/)
  })
})
