/**
 * B15 — adminCorrectSafetyField : internalMutation équipe uniquement.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  NUTRITION_SAFETY_ADMIN_AUDIT_TABLE,
  adminCorrectNutritionSafetyField,
  isNutritionProfileWriteAuthorized,
  writeNutritionProfileJson,
} from '../../convex/lib/nutritionProfile'
import { adminCorrectSafetyField } from '../../convex/nutrition'

type TableName =
  | 'auth_users'
  | 'auth_sessions'
  | 'nutrition_state'
  | 'nutrition_safety_admin_audit'
  | 'nutrition_age_majority_audit'
  | 'nutrition_safety_clear_audit'
  | 'nutrition_meals'

type StoredRow = Record<string, unknown> & { _id: string }

class GuardedFakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {
    auth_users: [],
    auth_sessions: [],
    nutrition_state: [],
    nutrition_safety_admin_audit: [],
    nutrition_age_majority_audit: [],
    nutrition_safety_clear_audit: [],
    nutrition_meals: [],
  }

  private assertAuthorized(value: Record<string, unknown>) {
    if (!('profileJson' in value)) return
    if (!isNutritionProfileWriteAuthorized()) {
      throw new Error('UNAUTHORIZED_PROFILE_JSON_WRITE')
    }
  }

  insert(table: string, value: Record<string, unknown>) {
    try {
      if (table === 'nutrition_state') this.assertAuthorized(value)
    } catch (err) {
      return Promise.reject(err)
    }
    if (!this.rows[table]) this.rows[table] = []
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.rows[table].push(row)
    return Promise.resolve(row._id)
  }

  query(table: string) {
    return new FakeQuery(this.rows[table] ?? [])
  }

  patch(id: string, patch: Record<string, unknown>) {
    for (const tableRows of Object.values(this.rows)) {
      const row = tableRows.find((c) => c._id === id)
      if (!row) continue
      try {
        if (String(row._id).startsWith('nutrition_state:')) this.assertAuthorized(patch)
      } catch (err) {
        return Promise.reject(err)
      }
      Object.assign(row, patch)
      return Promise.resolve()
    }
    return Promise.reject(new Error(`Row not found: ${id}`))
  }

  table(name: TableName): StoredRow[] {
    return this.rows[name] ?? []
  }
}

class FakeQuery {
  private filtered: StoredRow[]
  constructor(rows: StoredRow[]) {
    this.filtered = [...rows]
  }
  withIndex(
    _i: string,
    fn: (q: { eq: (f: string, v: unknown) => { eq: (f: string, v: unknown) => unknown } }) => unknown,
  ) {
    const filters: Array<{ field: string; value: unknown }> = []
    const b = {
      eq: (field: string, value: unknown) => {
        filters.push({ field, value })
        return b
      },
    }
    fn(b)
    this.filtered = this.filtered.filter((row) =>
      filters.every((f) => row[f.field] === f.value),
    )
    return this
  }
  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }
}

const USER = 'user-admin-b15'
const SESSION = 'session-admin-b15'

function handlerOf(fn: unknown) {
  return (fn as { _handler: (c: unknown, a: unknown) => Promise<unknown> })._handler
}

describe('B15 — adminCorrectSafetyField', () => {
  it('(a) est internalMutation et absente de l’API publique app', () => {
    const nutritionSrc = readFileSync(
      join(new URL('../../convex/nutrition.ts', import.meta.url).pathname),
      'utf8',
    )
    expect(nutritionSrc).toMatch(
      /export const adminCorrectSafetyField = internalMutation\(/,
    )
    // Pas de mutation publique du même nom
    expect(nutritionSrc).not.toMatch(
      /export const adminCorrectSafetyField = mutation\(/,
    )
    // Le client ne référence pas adminCorrectSafetyField
    const clientSrc = readFileSync(
      join(new URL('../services/convexNutritionService.ts', import.meta.url).pathname),
      'utf8',
    )
    expect(clientSrc).not.toContain('adminCorrectSafetyField')
  })

  it('(b) retirer TCA via admin écrit un audit userId+field+at', async () => {
    const db = new GuardedFakeDb()
    const now = Date.now()
    await db.insert('auth_users', {
      userId: USER,
      email: 'a@example.com',
      emailNorm: 'a@example.com',
      displayName: 'A',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('auth_sessions', {
      userId: USER,
      tokenHash: await hashToken(SESSION),
      createdAt: now,
      expiresAt: now + 86_400_000,
    })
    await writeNutritionProfileJson({ db } as never, {
      userId: USER,
      incomingProfileJson: {
        age: 28,
        declaredEatingDisorder: true,
        healthAnswer: 'situations',
      },
      journalJson: {},
      updatedAt: now,
    })

    const result = await handlerOf(adminCorrectSafetyField)(
      { db },
      { userId: USER, field: 'declaredEatingDisorder', value: false },
    )
    expect((result as { applied: boolean }).applied).toBe(true)

    const row = db.table('nutrition_state')[0]
    const profile = row.profileJson as Record<string, unknown>
    expect(profile.declaredEatingDisorder).toBeUndefined()

    const audits = db.table(NUTRITION_SAFETY_ADMIN_AUDIT_TABLE)
    expect(audits).toHaveLength(1)
    expect(audits[0].userId).toBe(USER)
    expect(audits[0].field).toBe('declaredEatingDisorder')
    expect(typeof audits[0].at).toBe('number')
    expect(audits[0]).not.toHaveProperty('value')
    expect(Object.keys(audits[0]).sort()).toEqual(['_id', 'at', 'field', 'userId'])
  })

  it('helper direct : false→true aussi possible (bypass never-true→false)', async () => {
    const db = new GuardedFakeDb()
    const r = await adminCorrectNutritionSafetyField({ db } as never, {
      userId: USER,
      field: 'declaredEatingDisorder',
      value: true,
    })
    expect(r.applied).toBe(true)
    expect(db.table(NUTRITION_SAFETY_ADMIN_AUDIT_TABLE)).toHaveLength(1)
  })
})
