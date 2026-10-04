import { describe, expect, it } from 'vitest'
import {
  deleteAccountAndUserData,
  NUTRITION_DELETE_BATCH_SIZE,
  NUTRITION_USER_CHILD_TABLES,
  purgeNutritionUserDataBatch,
} from '../../convex/auth'
import { hashPassword, hashToken } from '../../convex/lib/authCrypto'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'auth_password_reset_tokens'
  | 'auth_password_reset_outbox'
  | 'auth_private_notes'
  | 'profiles'
  | 'workouts_state'
  | 'nutrition_state'
  | 'nutrition_meals'
  | 'nutrition_water_entries'
  | 'nutrition_day_state'
  | 'nutrition_food_catalog'
  | 'sleep_nights'
  | 'checkins'
  | 'custom_spots'
  | 'active_checkins'
  | 'aliments'
  | 'activities'
  | 'ai_usage_limits'
  | 'streak_state'
  | 'user_files'
  | 'legacy_supabase_backups'
  | 'migration_entity_map'
  | 'rate_limit_buckets'
  | 'user_blocks'
  | 'user_follows'
  | 'activity_comments'
  | 'activity_reactions'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    auth_password_reset_tokens: [],
    auth_password_reset_outbox: [],
    auth_private_notes: [],
    profiles: [],
    workouts_state: [],
    nutrition_state: [],
    nutrition_meals: [],
    nutrition_water_entries: [],
    nutrition_day_state: [],
    nutrition_food_catalog: [],
    sleep_nights: [],
    checkins: [],
    custom_spots: [],
    active_checkins: [],
    aliments: [],
    activities: [],
    ai_usage_limits: [],
    streak_state: [],
    user_files: [],
    legacy_supabase_backups: [],
    migration_entity_map: [],
    rate_limit_buckets: [],
    user_blocks: [],
    user_follows: [],
    activity_comments: [],
    activity_reactions: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  delete(id: string) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key].splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
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
    fn: (q: { eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown } }) => unknown,
  ) {
    const filters: Array<{ field: string; value: unknown }> = []
    const rangeBuilder = {
      eq: (field: string, value: unknown) => {
        filters.push({ field, value })
        return rangeBuilder
      },
    }
    fn(rangeBuilder)
    this.filtered = this.filtered.filter((row) =>
      filters.every((filter) => row[filter.field] === filter.value),
    )
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

function createCtx(db: FakeDb) {
  return { db, storage: { delete: async () => undefined } }
}

async function seedUser(db: FakeDb, userId: string, password: string, sessionToken: string) {
  const now = Date.now()
  await db.insert('auth_users', {
    userId,
    email: `${userId}@example.com`,
    emailNorm: `${userId}@example.com`,
    displayName: userId,
    mustResetPassword: false,
    createdAt: now,
    updatedAt: now,
  })
  await db.insert('auth_password_credentials', {
    userId,
    passwordHash: await hashPassword(password),
    updatedAt: now,
  })
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + 60_000,
  })
}

describe('SEC-DON-02 — suppression tables nutrition', () => {
  it('vide les 4 tables pour l’utilisateur supprimé, laisse l’autre intact', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'password-a', 'session-a')
    await seedUser(db, 'user-b', 'password-b', 'session-b')
    const now = Date.now()

    for (const userId of ['user-a', 'user-b'] as const) {
      await db.insert('nutrition_meals', {
        userId,
        mealId: `m-${userId}`,
        dateKey: '2026-10-01',
        mealType: 'lunch',
        name: 'Test',
        calories: 400,
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      })
      await db.insert('nutrition_water_entries', {
        userId,
        entryId: `w-${userId}`,
        dateKey: '2026-10-01',
        amountMl: 250,
        type: 'glass',
        label: 'Verre',
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      })
      await db.insert('nutrition_day_state', {
        userId,
        dateKey: '2026-10-01',
        updatedAt: now,
        schemaVersion: 1,
      })
      await db.insert('nutrition_food_catalog', {
        userId,
        foodKey: `f-${userId}`,
        name: 'Yaourt',
        caloriesPer100g: 100,
        proteinPer100g: 5,
        carbsPer100g: 10,
        fatPer100g: 3,
        source: 'manual',
        lastFetchedAt: now,
        lastSelectedAt: now,
        selectedCount: 1,
        isFavorite: false,
        updatedAt: now,
        schemaVersion: 1,
      })
      await db.insert('nutrition_state', {
        userId,
        profileJson: {},
        journalJson: {},
        updatedAt: now,
      })
    }

    await deleteAccountAndUserData(ctx as never, {
      sessionToken: 'session-a',
      password: 'password-a',
    })

    for (const table of [
      'nutrition_meals',
      'nutrition_water_entries',
      'nutrition_day_state',
      'nutrition_food_catalog',
      'nutrition_state',
    ] as const) {
      expect(db.table(table).filter((r) => r.userId === 'user-a')).toHaveLength(0)
      expect(db.table(table).filter((r) => r.userId === 'user-b')).toHaveLength(1)
    }
  })

  it('multi-lots : purge par batch jusqu’à vide', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const userId = 'user-lots'
    const now = Date.now()
    const batch = 3
    for (let i = 0; i < batch * 2 + 1; i += 1) {
      await db.insert('nutrition_meals', {
        userId,
        mealId: `m-${i}`,
        dateKey: '2026-10-01',
        mealType: 'lunch',
        name: 'Meal',
        calories: 100,
        createdAt: now,
        updatedAt: now + i,
        schemaVersion: 1,
      })
    }
    const deleted = new Set<string>()
    let remaining = true
    let guard = 0
    while (remaining && guard < 20) {
      const result = await purgeNutritionUserDataBatch(ctx as never, userId, deleted, batch)
      remaining = result.remaining
      guard += 1
    }
    expect(db.table('nutrition_meals')).toHaveLength(0)
    expect(NUTRITION_DELETE_BATCH_SIZE).toBe(500)
  })

  it('exhaustivité : tables userId nutrition listées avec exceptions commentées', () => {
    // Tables schema contenant userId côté nutrition — doivent être nettoyées.
    const nutritionUserTablesInSchema = [
      'nutrition_state',
      'nutrition_meals',
      'nutrition_water_entries',
      'nutrition_day_state',
      'nutrition_food_catalog',
    ]
    const cleanedChildTables = NUTRITION_USER_CHILD_TABLES.map((t) => t.table)
    // Exception explicite : nutrition_state est supprimée dans deleteAccountAndUserData
    // via by_userId (hors NUTRITION_USER_CHILD_TABLES car déjà historiquement gérée).
    const explicitExceptions = ['nutrition_state'] as const
    for (const table of nutritionUserTablesInSchema) {
      const covered =
        cleanedChildTables.includes(table as never) ||
        (explicitExceptions as readonly string[]).includes(table)
      expect(covered, `table nutrition oubliée: ${table}`).toBe(true)
    }
  })
})
