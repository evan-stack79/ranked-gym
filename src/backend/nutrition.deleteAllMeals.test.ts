import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hardDeleteAllUserMeals } from '../../convex/nutrition'
import {
  backupPayloadContainsMealName,
  journalJsonContainsMealName,
} from '../utils/stripJournalMeals'

type TableName = 'nutrition_meals' | 'nutrition_state' | 'legacy_supabase_backups'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    nutrition_meals: [],
    nutrition_state: [],
    legacy_supabase_backups: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.rows[table])
  }

  replace(id: string, value: Record<string, unknown>) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key][idx] = { _id: id, ...value }
      return Promise.resolve(id)
    }
    return Promise.reject(new Error(`replace: missing ${id}`))
  }

  patch(id: string, value: Record<string, unknown>) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key][idx] = { ...this.rows[key][idx], ...value }
      return Promise.resolve()
    }
    return Promise.reject(new Error(`patch: missing ${id}`))
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
    fn: (q: {
      eq: (field: string, value: unknown) => { eq: (field: string, value: unknown) => unknown }
    }) => unknown,
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
}

describe('deleteAllMyMeals — hard-delete + multi-store meal purge', () => {
  const source = readFileSync(new URL('../../convex/nutrition.ts', import.meta.url), 'utf8')

  it('expose countActiveMeals et deleteAllMyMeals sans assertFoodWriteAccess', () => {
    expect(source).toContain('export const countActiveMeals')
    expect(source).toContain('export const deleteAllMyMeals')
    expect(source).toContain('hardDeleteAllUserMeals')
    expect(source).toContain('mealSyncTombstone')
    expect(source).toContain('legacy_supabase_backups')
    expect(source).toContain('stripMealsFromBackupPayload')

    const countIdx = source.indexOf('export const countActiveMeals')
    const countBlock = source.slice(countIdx, countIdx + 900)
    expect(countBlock).toContain('sessionUserId')
    expect(countBlock).not.toContain('assertFoodWriteAccess')

    const delIdx = source.indexOf('export const deleteAllMyMeals')
    const delBlock = source.slice(delIdx, delIdx + 1200)
    expect(delBlock).toContain('sessionUserId')
    expect(delBlock).not.toContain('assertFoodWriteAccess')
    expect(delBlock).toContain('hardDeleteAllUserMeals')
  })

  it('après delete-all : aucun nom de repas dans meals, journalJson, legacy_supabase_backups', async () => {
    const db = new FakeDb()
    const ctx = { db }
    const now = 1_700_000_000_000
    const userId = 'user-erase'
    const mealName = 'Skyr Vanille'

    await db.insert('nutrition_meals', {
      userId,
      mealId: 'meal-a',
      dateKey: '2026-10-14',
      mealType: 'lunch',
      name: mealName,
      calories: 120,
      proteinG: 15,
      carbsG: 8,
      fatG: 0,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    })
    await db.insert('nutrition_meals', {
      userId,
      mealId: 'meal-b',
      dateKey: '2026-10-13',
      mealType: 'dinner',
      name: 'Pomme Golden',
      calories: 52,
      createdAt: now,
      updatedAt: now,
      deletedAt: now - 1000,
      schemaVersion: 1,
    })
    await db.insert('nutrition_meals', {
      userId: 'other-user',
      mealId: 'meal-other',
      dateKey: '2026-10-14',
      mealType: 'snack',
      name: 'Keep me',
      calories: 99,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    })
    await db.insert('nutrition_state', {
      userId,
      profileJson: { age: 16 },
      journalJson: {
        '2026-10-14': {
          meals: [{ id: 'meal-a', name: mealName, calories: 120 }],
          waterEntries: [{ id: 'w1', amountMl: 250, type: 'glass', label: 'Verre', createdAt: now }],
          waterMl: 250,
        },
      },
      updatedAt: now,
    })
    await db.insert('legacy_supabase_backups', {
      userId,
      source: 'supabase_user_backups',
      updatedAt: now,
      payloadJson: {
        nutrition: {
          profile: { age: 16 },
          journal: {
            '2026-10-14': {
              meals: [{ id: 'meal-a', name: mealName, calories: 120 }],
              waterMl: 250,
            },
          },
        },
        training: { routines: [{ name: 'Push' }] },
      },
    })

    const result = await hardDeleteAllUserMeals(ctx as never, userId, now + 50)

    expect(result.deletedCount).toBe(2)

    const mine = db.table('nutrition_meals').filter((r) => r.userId === userId)
    expect(mine).toHaveLength(2)
    for (const row of mine) {
      expect(Object.keys(row).sort()).toEqual(['_id', 'deletedAt', 'mealId', 'updatedAt', 'userId'])
      expect(row.name).toBeUndefined()
      expect(JSON.stringify(row)).not.toContain(mealName)
      expect(JSON.stringify(row)).not.toContain('Pomme Golden')
    }

    const state = db.table('nutrition_state').find((r) => r.userId === userId)
    expect(journalJsonContainsMealName(state?.journalJson, mealName)).toBe(false)
    expect(journalJsonContainsMealName(state?.journalJson, 'Pomme Golden')).toBe(false)
    // Eau conservée
    const day = (state?.journalJson as Record<string, { waterMl?: number; meals?: unknown[] }>)[
      '2026-10-14'
    ]
    expect(day.meals).toEqual([])
    expect(day.waterMl).toBe(250)
    expect(state?.profileJson).toEqual({ age: 16 })

    const legacy = db.table('legacy_supabase_backups').find((r) => r.userId === userId)
    expect(backupPayloadContainsMealName(legacy?.payloadJson, mealName)).toBe(false)
    expect(backupPayloadContainsMealName(legacy?.payloadJson, 'Pomme Golden')).toBe(false)
    const legacyPayload = legacy?.payloadJson as {
      nutrition: { journal: Record<string, { meals: unknown[]; waterMl?: number }>; profile: unknown }
      training: { routines: unknown[] }
    }
    expect(legacyPayload.nutrition.journal['2026-10-14'].meals).toEqual([])
    expect(legacyPayload.nutrition.journal['2026-10-14'].waterMl).toBe(250)
    expect(legacyPayload.nutrition.profile).toEqual({ age: 16 })
    expect(legacyPayload.training.routines).toEqual([{ name: 'Push' }])

    const other = db.table('nutrition_meals').find((r) => r.userId === 'other-user')
    expect(other?.name).toBe('Keep me')
  })
})
