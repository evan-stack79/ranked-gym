import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { hardDeleteAllUserMeals } from '../../convex/nutrition'

type TableName = 'nutrition_meals' | 'nutrition_state'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    nutrition_meals: [],
    nutrition_state: [],
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

describe('deleteAllMyMeals — hard-delete tombstones', () => {
  const source = readFileSync(new URL('../../convex/nutrition.ts', import.meta.url), 'utf8')

  it('expose countActiveMeals et deleteAllMyMeals sans assertFoodWriteAccess', () => {
    expect(source).toContain('export const countActiveMeals')
    expect(source).toContain('export const deleteAllMyMeals')
    expect(source).toContain('hardDeleteAllUserMeals')
    expect(source).toContain('mealSyncTombstone')

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

  it('après delete-all : aucun contenu repas ; tombstones id+deletedAt ; journalJson vide', async () => {
    const db = new FakeDb()
    const ctx = { db }
    const now = 1_700_000_000_000
    const userId = 'user-erase'

    await db.insert('nutrition_meals', {
      userId,
      mealId: 'meal-a',
      dateKey: '2026-10-14',
      mealType: 'lunch',
      name: 'Skyr',
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
      name: 'Pomme',
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
        '2026-10-14': { meals: [{ id: 'meal-a', name: 'Skyr', calories: 120 }] },
      },
      updatedAt: now,
    })

    const result = await hardDeleteAllUserMeals(ctx as never, userId, now + 50)

    expect(result.deletedCount).toBe(2)
    expect(result.updatedAt).toBe(now + 50)

    const mine = db.table('nutrition_meals').filter((r) => r.userId === userId)
    expect(mine).toHaveLength(2)
    for (const row of mine) {
      expect(Object.keys(row).sort()).toEqual(['_id', 'deletedAt', 'mealId', 'updatedAt', 'userId'])
      expect(row.deletedAt).toBe(now + 50)
      expect(row.updatedAt).toBe(now + 50)
      expect(row.name).toBeUndefined()
      expect(row.calories).toBeUndefined()
      expect(row.dateKey).toBeUndefined()
      expect(row.proteinG).toBeUndefined()
      expect(row.carbsG).toBeUndefined()
      expect(row.fatG).toBeUndefined()
      expect(row.mealType).toBeUndefined()
    }
    expect(mine.map((r) => r.mealId).sort()).toEqual(['meal-a', 'meal-b'])

    const other = db.table('nutrition_meals').find((r) => r.userId === 'other-user')
    expect(other?.name).toBe('Keep me')
    expect(other?.calories).toBe(99)

    const state = db.table('nutrition_state').find((r) => r.userId === userId)
    expect(state?.journalJson).toEqual({})
    expect(state?.profileJson).toEqual({ age: 16 })
  })
})
