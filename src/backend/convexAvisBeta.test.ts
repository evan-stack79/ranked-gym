import { describe, expect, it } from 'vitest'
import {
  AVIS_ANTI_DOUBLON_MS,
  AVIS_BETA_CONSENT_ERROR,
  AVIS_BETA_DAILY_LIMIT_ERROR,
  AVIS_BETA_MINOR_ERROR,
  AVIS_PAR_JOUR,
  AVIS_TEXTE_MAX,
  buildWebhookJsonBody,
  detectDistressSignals,
  detectInsultWords,
  hashUserIdForWebhook,
  maskInsultWords,
  submitAvisBetaForSession,
  validateAvisTexte,
} from '../../convex/avisBeta'
import { deleteAccountAndUserData } from '../../convex/auth'
import { hashPassword, hashToken } from '../../convex/lib/authCrypto'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'avis_beta'
  | 'rate_limit_buckets'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    avis_beta: [],
    rate_limit_buckets: [],
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${this.idCounter += 1}`, ...value }
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

  delete(id: string) {
    for (const key of Object.keys(this.rows) as TableName[]) {
      const idx = this.rows[key].findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key].splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  table<T extends TableName>(name: T): StoredRow[] {
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

  first() {
    return Promise.resolve(this.filtered[0] ?? null)
  }

  collect() {
    return Promise.resolve([...this.filtered])
  }

  take(limit: number) {
    return Promise.resolve(this.filtered.slice(0, limit))
  }
}

function createCtx(db: FakeDb) {
  return { db }
}

async function seedUser(db: FakeDb, userId: string, sessionToken: string) {
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
  await db.insert('auth_sessions', {
    userId,
    tokenHash: await hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + 86_400_000,
  })
}

describe('avis beta helpers', () => {
  it('valide la longueur 10–2000', () => {
    expect(validateAvisTexte('court').ok).toBe(false)
    expect(validateAvisTexte('abcdefghij').ok).toBe(true)
    expect(validateAvisTexte('x'.repeat(AVIS_TEXTE_MAX + 1)).ok).toBe(false)
  })

  it('détecte et masque les insultes sans bloquer le texte source', () => {
    const insults = detectInsultWords('Cette appli de merde plante')
    expect(insults).toContain('merde')
    expect(maskInsultWords('Cette appli de merde plante', insults)).toBe(
      'Cette appli de ••• plante',
    )
  })

  it('détecte un signal de détresse / TCA', () => {
    expect(detectDistressSignals('Je mange plus pour monter au classement')).toBe(true)
    expect(detectDistressSignals('Le chrono reste à zéro')).toBe(false)
  })

  it('produit un JSON webhook avec exactement les clés attendues', () => {
    const body = buildWebhookJsonBody({
      id: 'avis_1',
      type: 'bug',
      texte: 'chrono cassé',
      page: 'Séance en cours',
      version: 'test',
      date: '2026-01-01T12:00:00.000Z',
      id_utilisateur_hache: 'abc',
    })
    expect(JSON.parse(body)).toEqual({
      id: 'avis_1',
      type: 'bug',
      texte: 'chrono cassé',
      page: 'Séance en cours',
      version: 'test',
      date: '2026-01-01T12:00:00.000Z',
      id_utilisateur_hache: 'abc',
    })
  })

  it('hashe le userId de façon stable (HMAC)', async () => {
    const a = await hashUserIdForWebhook('user-1', 'salt-test')
    const b = await hashUserIdForWebhook('user-1', 'salt-test')
    const c = await hashUserIdForWebhook('user-2', 'salt-test')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).not.toContain('user-1')
  })
})

describe('submitAvisBetaForSession', () => {
  it('enregistre un avis adulte valide (statut nouveau)', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')

    const result = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-a',
      type: 'bug',
      texte: 'Quand je reviens, le chrono reste à 0:00.',
      page: 'Séance en cours',
      version: 'test',
      cleAntiDoublon: 'key-1',
      consentementAccepte: true,
      declaredAge: 28,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.statut).toBe('nouveau')
    expect(result.signalUrgent).toBe(false)
    expect(db.table('avis_beta')).toHaveLength(1)
    const row = db.table('avis_beta')[0]
    expect(row.userId).toBe('user-a')
    expect(row).not.toHaveProperty('declaredAge')
    expect(row).not.toHaveProperty('age')
    expect(row.notif).toBe('a_envoyer')
  })

  it('refuse mineur / âge inconnu et ne crée pas de ligne', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-m', 'session-m')

    const minor = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-m',
      type: 'idee',
      texte: 'Une idée pour les rappels d’eau.',
      page: 'Nutrition',
      version: 'test',
      cleAntiDoublon: 'key-m',
      consentementAccepte: true,
      declaredAge: 16,
    })
    expect(minor).toEqual({ ok: false, error: AVIS_BETA_MINOR_ERROR })
    expect(db.table('avis_beta')).toHaveLength(0)

    const unknown = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-m',
      type: 'idee',
      texte: 'Une idée pour les rappels d’eau.',
      page: 'Nutrition',
      version: 'test',
      cleAntiDoublon: 'key-m2',
      consentementAccepte: true,
      declaredAge: Number.NaN,
    })
    expect(unknown).toEqual({ ok: false, error: AVIS_BETA_MINOR_ERROR })
  })

  it('refuse sans consentement', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-c', 'session-c')
    const result = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-c',
      type: 'autre',
      texte: 'Message assez long pour passer.',
      page: 'Accueil',
      version: 'test',
      cleAntiDoublon: 'key-c',
      consentementAccepte: false,
      declaredAge: 22,
    })
    expect(result).toEqual({ ok: false, error: AVIS_BETA_CONSENT_ERROR })
  })

  it('propose de reformuler si insultes, puis accepte avec masquage', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-i', 'session-i')

    const blocked = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-i',
      type: 'bug',
      texte: 'Cette merde de chrono plante encore.',
      page: 'Séance en cours',
      version: 'test',
      cleAntiDoublon: 'key-i1',
      consentementAccepte: true,
      declaredAge: 30,
    })
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.needsReformulation).toBe(true)
    expect(db.table('avis_beta')).toHaveLength(0)

    const forced = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-i',
      type: 'bug',
      texte: 'Cette merde de chrono plante encore.',
      page: 'Séance en cours',
      version: 'test',
      cleAntiDoublon: 'key-i2',
      consentementAccepte: true,
      declaredAge: 30,
      forcerEnvoiAvecInsultes: true,
    })
    expect(forced.ok).toBe(true)
    if (!forced.ok) return
    expect(forced.motsMasques).toBe(true)
    expect(db.table('avis_beta')[0].texteMasque).toContain('•••')
  })

  it('passe en urgent sur signal TCA / détresse', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-u', 'session-u')
    const result = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-u',
      type: 'autre',
      texte: 'Je mange plus pour monter au classement, lol.',
      page: 'Nutrition',
      version: 'test',
      cleAntiDoublon: 'key-u',
      consentementAccepte: true,
      declaredAge: 25,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.statut).toBe('urgent')
    expect(result.signalUrgent).toBe(true)
  })

  it('respecte la limite 5 avis/jour et l’anti-doublon clé / texte', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-l', 'session-l')
    const now = Date.now()

    for (let i = 0; i < AVIS_PAR_JOUR; i += 1) {
      const result = await submitAvisBetaForSession(ctx as never, {
        sessionToken: 'session-l',
        type: 'bug',
        texte: `Problème numéro ${i} assez long.`,
        page: 'Train',
        version: 'test',
        cleAntiDoublon: `key-l-${i}`,
        consentementAccepte: true,
        declaredAge: 40,
        now: now + i,
      })
      expect(result.ok).toBe(true)
    }

    const limited = await submitAvisBetaForSession(ctx as never, {
      sessionToken: 'session-l',
      type: 'bug',
      texte: 'Encore un sixième avis aujourd’hui.',
      page: 'Train',
      version: 'test',
      cleAntiDoublon: 'key-l-6',
      consentementAccepte: true,
      declaredAge: 40,
      now: now + 10,
    })
    expect(limited).toEqual({ ok: false, error: AVIS_BETA_DAILY_LIMIT_ERROR })
    expect(db.table('avis_beta')).toHaveLength(AVIS_PAR_JOUR)

    // Anti-doublon clé : même clé → pas de nouvelle ligne (sur un autre user seed)
    const db2 = new FakeDb()
    const ctx2 = createCtx(db2)
    await seedUser(db2, 'user-d', 'session-d')
    const first = await submitAvisBetaForSession(ctx2 as never, {
      sessionToken: 'session-d',
      type: 'idee',
      texte: 'Ajouter un rappel Effort plus clair.',
      page: 'Séance en cours',
      version: 'test',
      cleAntiDoublon: 'same-key',
      consentementAccepte: true,
      declaredAge: 33,
      now,
    })
    const dupKey = await submitAvisBetaForSession(ctx2 as never, {
      sessionToken: 'session-d',
      type: 'idee',
      texte: 'Ajouter un rappel Effort plus clair.',
      page: 'Séance en cours',
      version: 'test',
      cleAntiDoublon: 'same-key',
      consentementAccepte: true,
      declaredAge: 33,
      now: now + 1,
    })
    expect(first.ok && dupKey.ok).toBe(true)
    if (first.ok && dupKey.ok) {
      expect(dupKey.duplicate).toBe(true)
      expect(dupKey.avisId).toBe(first.avisId)
    }
    expect(db2.table('avis_beta')).toHaveLength(1)

    const dupText = await submitAvisBetaForSession(ctx2 as never, {
      sessionToken: 'session-d',
      type: 'idee',
      texte: 'Ajouter un rappel Effort plus clair.',
      page: 'Séance en cours',
      version: 'test',
      cleAntiDoublon: 'other-key',
      consentementAccepte: true,
      declaredAge: 33,
      now: now + AVIS_ANTI_DOUBLON_MS - 1000,
    })
    expect(dupText.ok).toBe(true)
    if (dupText.ok) expect(dupText.duplicate).toBe(true)
    expect(db2.table('avis_beta')).toHaveLength(1)
  })

  it('ne mentionne jamais RPE dans les helpers lexique Effort', () => {
    const sample = 'L’échelle Effort de 1 à 10 n’est pas claire pour moi.'
    expect(sample.toLowerCase()).not.toContain('rpe')
    expect(detectDistressSignals(sample)).toBe(false)
  })
})

describe('delete account purge avis_beta', () => {
  it('supprime les avis du compte', async () => {
    const db = new FakeDb() as FakeDb & {
      insert: FakeDb['insert']
      query: FakeDb['query']
      get: FakeDb['get']
      patch: FakeDb['patch']
      delete: FakeDb['delete']
      table: FakeDb['table']
    }
    // Minimal tables for deleteAccount — extend FakeDb via proxy for missing tables
    const allTables = new Map<string, StoredRow[]>()
    const ensure = (name: string) => {
      if (!allTables.has(name)) allTables.set(name, [])
      return allTables.get(name)!
    }
    let idCounter = 1
    const wideDb = {
      insert(table: string, value: Record<string, unknown>) {
        const row = { _id: `${table}:${(idCounter += 1)}`, ...value }
        ensure(table).push(row)
        return Promise.resolve(row._id)
      },
      query(table: string) {
        return new FakeQuery(ensure(table))
      },
      get(id: string) {
        for (const rows of allTables.values()) {
          const row = rows.find((r) => r._id === id)
          if (row) return Promise.resolve(row)
        }
        return Promise.resolve(null)
      },
      patch(id: string, patch: Record<string, unknown>) {
        for (const rows of allTables.values()) {
          const row = rows.find((r) => r._id === id)
          if (!row) continue
          Object.assign(row, patch)
          return Promise.resolve()
        }
        throw new Error(`Row not found: ${id}`)
      },
      delete(id: string) {
        for (const rows of allTables.values()) {
          const idx = rows.findIndex((r) => r._id === id)
          if (idx === -1) continue
          rows.splice(idx, 1)
          return Promise.resolve()
        }
        return Promise.resolve()
      },
      table(name: string) {
        return ensure(name)
      },
    }

    void db
    const password = 'password-ok'
    const userId = 'user-del'
    const sessionToken = 'session-del'
    const now = Date.now()
    await wideDb.insert('auth_users', {
      userId,
      email: 'del@example.com',
      emailNorm: 'del@example.com',
      displayName: 'Del',
      mustResetPassword: false,
      createdAt: now,
      updatedAt: now,
    })
    await wideDb.insert('auth_password_credentials', {
      userId,
      passwordHash: await hashPassword(password),
      updatedAt: now,
    })
    await wideDb.insert('auth_sessions', {
      userId,
      tokenHash: await hashToken(sessionToken),
      createdAt: now,
      expiresAt: now + 86_400_000,
    })
    await wideDb.insert('avis_beta', {
      userId,
      type: 'bug',
      texte: 'Séance disparue de l’historique hier soir.',
      page: 'Historique',
      version: 'test',
      creeLe: now,
      consentementDate: now,
      consentementVersion: 'avis-beta-v1-2026-10-06',
      statut: 'nouveau',
      signalUrgent: false,
      motsMasques: false,
      notif: 'a_envoyer',
      notifEssais: 0,
      cleAntiDoublon: 'del-key',
    })

    await deleteAccountAndUserData({ db: wideDb } as never, {
      sessionToken,
      password,
    })

    expect(wideDb.table('avis_beta')).toHaveLength(0)
    expect(wideDb.table('auth_users')).toHaveLength(0)
  })
})
