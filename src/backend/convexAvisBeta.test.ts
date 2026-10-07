import { describe, expect, it } from 'vitest'
import {
  AVIS_ANTI_DOUBLON_MS,
  AVIS_BETA_CONSENT_ERROR,
  AVIS_BETA_DAILY_LIMIT_ERROR,
  AVIS_BETA_MINOR_ERROR,
  AVIS_PAR_JOUR,
  AVIS_TEXTE_MAX,
  assertAdultFromStoredProfile,
  buildWebhookJsonBody,
  detectDistressLevel,
  detectInsultWords,
  extractAgeFromNutritionProfileJson,
  hashUserIdForWebhook,
  isAdultStoredAge,
  maskInsultWords,
  sanitizeSyncedNutritionProfileJson,
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
  | 'nutrition_state'
  | 'rate_limit_buckets'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<TableName, StoredRow[]> = {
    auth_users: [],
    auth_password_credentials: [],
    auth_sessions: [],
    avis_beta: [],
    nutrition_state: [],
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

/** AV-01 — âge serveur dans nutrition_state.profileJson (jamais envoyé par le client). */
async function seedStoredAge(db: FakeDb, userId: string, age: number | undefined) {
  await db.insert('nutrition_state', {
    userId,
    profileJson: age === undefined ? {} : { age },
    updatedAt: Date.now(),
  })
}

const baseSubmit = {
  type: 'bug' as const,
  texte: 'Quand je reviens, le chrono reste à 0:00.',
  page: 'Séance en cours',
  version: 'test',
  consentementAccepte: true,
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

  it('détecte un signal de détresse / TCA (niveau 1, pas faux positif légumes)', () => {
    expect(detectDistressLevel('Je mange presque plus pour monter au classement')).toBe(1)
    expect(detectDistressLevel('Je mange plus de légumes')).toBe(0)
    expect(detectDistressLevel('Le chrono reste à zéro')).toBe(0)
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

describe('AV-01 — âge serveur (nutrition_state), jamais declaredAge', () => {
  it('isAdultStoredAge fail-closed', () => {
    expect(isAdultStoredAge(18)).toBe(true)
    expect(isAdultStoredAge(30)).toBe(true)
    expect(isAdultStoredAge(17)).toBe(false)
    expect(isAdultStoredAge(undefined)).toBe(false)
    expect(isAdultStoredAge(null)).toBe(false)
    expect(isAdultStoredAge('30')).toBe(false)
    expect(isAdultStoredAge(Number.NaN)).toBe(false)
    expect(isAdultStoredAge(121)).toBe(false)
  })

  it('extrait age depuis profileJson uniquement', () => {
    expect(extractAgeFromNutritionProfileJson({ age: 28 })).toBe(28)
    expect(extractAgeFromNutritionProfileJson({})).toBeUndefined()
    expect(extractAgeFromNutritionProfileJson(null)).toBeUndefined()
  })

  it('assertAdultFromStoredProfile refuse sans nutrition_state', async () => {
    const db = new FakeDb()
    const result = await assertAdultFromStoredProfile(createCtx(db) as never, 'user-x')
    expect(result).toEqual({ ok: false, error: AVIS_BETA_MINOR_ERROR })
  })

  it('assertAdultFromStoredProfile refuse mineur, accepte adulte', async () => {
    const db = new FakeDb()
    await seedStoredAge(db, 'user-m', 16)
    expect(await assertAdultFromStoredProfile(createCtx(db) as never, 'user-m')).toEqual({
      ok: false,
      error: AVIS_BETA_MINOR_ERROR,
    })

    const db2 = new FakeDb()
    await seedStoredAge(db2, 'user-a', 28)
    expect(await assertAdultFromStoredProfile(createCtx(db2) as never, 'user-a')).toEqual({
      ok: true,
    })
  })
})

describe('submitAvisBetaForSession', () => {
  it('enregistre un avis adulte valide (âge serveur, pas d’âge sur l’avis)', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'session-a')
    await seedStoredAge(db, 'user-a', 28)

    const result = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-a',
      cleAntiDoublon: 'key-1',
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

  it('refuse si âge serveur manquant / mineur et ignore tout âge client (fail-closed)', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-m', 'session-m')
    // Pas de nutrition_state → fail closed (même si un client envoie un âge spoofé)
    const missing = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-m',
      type: 'idee',
      texte: 'Une idée pour les rappels d’eau.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-m',
      declaredAge: 30,
    } as never)
    expect(missing).toEqual({ ok: false, error: AVIS_BETA_MINOR_ERROR })
    expect(db.table('avis_beta')).toHaveLength(0)

    // nutrition_state sans age dans profileJson → fail-closed
    await seedStoredAge(db, 'user-m', undefined)
    const emptyAge = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-m',
      type: 'idee',
      texte: 'Une idée pour les rappels d’eau.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-m-empty',
    })
    expect(emptyAge).toEqual({ ok: false, error: AVIS_BETA_MINOR_ERROR })
    expect(db.table('avis_beta')).toHaveLength(0)

    const db2 = new FakeDb()
    const ctx2 = createCtx(db2)
    await seedUser(db2, 'user-min', 'session-min')
    await seedStoredAge(db2, 'user-min', 16)
    const minor = await submitAvisBetaForSession(ctx2 as never, {
      ...baseSubmit,
      sessionToken: 'session-min',
      type: 'idee',
      texte: 'Une idée pour les rappels d’eau.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-m2',
    })
    expect(minor).toEqual({ ok: false, error: AVIS_BETA_MINOR_ERROR })
    expect(db2.table('avis_beta')).toHaveLength(0)
  })

  it('refuse sans consentement', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-c', 'session-c')
    await seedStoredAge(db, 'user-c', 22)
    const result = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-c',
      type: 'autre',
      texte: 'Message assez long pour passer.',
      page: 'Accueil',
      cleAntiDoublon: 'key-c',
      consentementAccepte: false,
    })
    expect(result).toEqual({ ok: false, error: AVIS_BETA_CONSENT_ERROR })
  })

  it('propose de reformuler si insultes, puis accepte avec masquage', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-i', 'session-i')
    await seedStoredAge(db, 'user-i', 30)

    const blocked = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-i',
      texte: 'Cette merde de chrono plante encore.',
      cleAntiDoublon: 'key-i1',
    })
    expect(blocked.ok).toBe(false)
    if (blocked.ok) return
    expect(blocked.needsReformulation).toBe(true)
    expect(db.table('avis_beta')).toHaveLength(0)

    const forced = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-i',
      texte: 'Cette merde de chrono plante encore.',
      cleAntiDoublon: 'key-i2',
      forcerEnvoiAvecInsultes: true,
    })
    expect(forced.ok).toBe(true)
    if (!forced.ok) return
    expect(forced.motsMasques).toBe(true)
    expect(db.table('avis_beta')[0].texteMasque).toContain('•••')
  })

  it('passe en urgent niveau 1 sur signal TCA, sans bloquer l’envoi', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-u', 'session-u')
    await seedStoredAge(db, 'user-u', 25)
    const result = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-u',
      type: 'autre',
      texte: 'Je mange presque plus pour monter au classement, lol.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-u',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.statut).toBe('urgent')
    expect(result.signalUrgent).toBe(true)
    expect(result.distressLevel).toBe(1)
    expect(db.table('avis_beta')[0].signalNiveau).toBe(1)
  })

  it('passe en urgent niveau 2 (suicide) et l’emporte sur le niveau 1', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-s', 'session-s')
    await seedStoredAge(db, 'user-s', 25)
    const result = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-s',
      type: 'autre',
      texte: 'Anorexie et j’ai envie de mourir, vraiment.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-s',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.distressLevel).toBe(2)
    expect(result.statut).toBe('urgent')
  })

  it('AV-04 — détresse contourne la limite journalière', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-l', 'session-l')
    await seedStoredAge(db, 'user-l', 40)
    const now = Date.now()

    for (let i = 0; i < AVIS_PAR_JOUR; i += 1) {
      const result = await submitAvisBetaForSession(ctx as never, {
        ...baseSubmit,
        sessionToken: 'session-l',
        texte: `Problème numéro ${i} assez long.`,
        page: 'Train',
        cleAntiDoublon: `key-l-${i}`,
        now: now + i,
      })
      expect(result.ok).toBe(true)
    }

    const limited = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-l',
      texte: 'Encore un sixième avis aujourd’hui.',
      page: 'Train',
      cleAntiDoublon: 'key-l-6',
      now: now + 10,
    })
    expect(limited).toEqual({ ok: false, error: AVIS_BETA_DAILY_LIMIT_ERROR })
    expect(db.table('avis_beta')).toHaveLength(AVIS_PAR_JOUR)

    const distress = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-l',
      type: 'autre',
      texte: 'j’ai envie de mourir vraiment beaucoup.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-l-distress',
      now: now + 20,
    })
    expect(distress.ok).toBe(true)
    if (!distress.ok) return
    expect(distress.distressLevel).toBe(2)
    expect(distress.statut).toBe('urgent')
    expect(db.table('avis_beta')).toHaveLength(AVIS_PAR_JOUR + 1)

    // AV-20 : second signal urgent le même jour → aide (distressLevel) mais pas de nouvelle ligne
    const second = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-l',
      type: 'autre',
      texte: 'encore des idees noires aujourd’hui vraiment.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-l-distress-2',
      now: now + 30,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.distressLevel).toBe(2)
    expect(second.duplicate).toBe(true)
    expect(db.table('avis_beta')).toHaveLength(AVIS_PAR_JOUR + 1)
  })

  it('AV-01 — sanitizeSyncedNutritionProfileJson refuse saut mineur→adulte', () => {
    const kept = sanitizeSyncedNutritionProfileJson({ age: 15 }, { age: 30, weightKg: 70 })
    expect(extractAgeFromNutritionProfileJson(kept)).toBe(15)
    expect((kept as { weightKg: number }).weightKg).toBe(70)

    const ok = sanitizeSyncedNutritionProfileJson({ age: 20 }, { age: 30 })
    expect(extractAgeFromNutritionProfileJson(ok)).toBe(30)

    const firstAdult = sanitizeSyncedNutritionProfileJson({}, { age: 28 })
    expect(extractAgeFromNutritionProfileJson(firstAdult)).toBe(28)
  })

  it('AV-20 — un seul urgent / jour même sous la limite des 5', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-u1', 'session-u1')
    await seedStoredAge(db, 'user-u1', 28)
    const now = Date.now()

    const first = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-u1',
      type: 'autre',
      texte: 'j’ai envie de mourir vraiment beaucoup.',
      page: 'Nutrition',
      cleAntiDoublon: 'u1-a',
      now,
    })
    expect(first.ok).toBe(true)
    expect(db.table('avis_beta').filter((r) => r.signalUrgent)).toHaveLength(1)

    const second = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-u1',
      type: 'autre',
      texte: 'je veux en finir avec mes jours vraiment.',
      page: 'Nutrition',
      cleAntiDoublon: 'u1-b',
      now: now + 1,
    })
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.distressLevel).toBe(2)
    expect(second.duplicate).toBe(true)
    expect(db.table('avis_beta').filter((r) => r.signalUrgent)).toHaveLength(1)
  })

  it('AV-05 — détresse avant insultes : envoi masqué, pas de reformulation', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-di', 'session-di')
    await seedStoredAge(db, 'user-di', 30)

    const result = await submitAvisBetaForSession(ctx as never, {
      ...baseSubmit,
      sessionToken: 'session-di',
      type: 'autre',
      texte: 'putain j’ai envie de mourir ce soir.',
      page: 'Nutrition',
      cleAntiDoublon: 'key-di',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.needsReformulation).toBe(false)
    expect(result.distressLevel).toBe(2)
    expect(result.motsMasques).toBe(true)
    expect(db.table('avis_beta')[0].texteMasque).toContain('•••')
  })

  it('respecte l’anti-doublon clé / texte', async () => {
    const db2 = new FakeDb()
    const ctx2 = createCtx(db2)
    await seedUser(db2, 'user-d', 'session-d')
    await seedStoredAge(db2, 'user-d', 33)
    const now = Date.now()

    const first = await submitAvisBetaForSession(ctx2 as never, {
      ...baseSubmit,
      sessionToken: 'session-d',
      type: 'idee',
      texte: 'Ajouter un rappel Effort plus clair.',
      cleAntiDoublon: 'same-key',
      now,
    })
    const dupKey = await submitAvisBetaForSession(ctx2 as never, {
      ...baseSubmit,
      sessionToken: 'session-d',
      type: 'idee',
      texte: 'Ajouter un rappel Effort plus clair.',
      cleAntiDoublon: 'same-key',
      now: now + 1,
    })
    expect(first.ok && dupKey.ok).toBe(true)
    if (first.ok && dupKey.ok) {
      expect(dupKey.duplicate).toBe(true)
      expect(dupKey.avisId).toBe(first.avisId)
    }
    expect(db2.table('avis_beta')).toHaveLength(1)

    const dupText = await submitAvisBetaForSession(ctx2 as never, {
      ...baseSubmit,
      sessionToken: 'session-d',
      type: 'idee',
      texte: 'Ajouter un rappel Effort plus clair.',
      cleAntiDoublon: 'other-key',
      now: now + AVIS_ANTI_DOUBLON_MS - 1000,
    })
    expect(dupText.ok).toBe(true)
    if (dupText.ok) expect(dupText.duplicate).toBe(true)
    expect(db2.table('avis_beta')).toHaveLength(1)
  })

  it('ne mentionne jamais RPE dans les helpers lexique Effort', () => {
    const sample = 'L’échelle Effort de 1 à 10 n’est pas claire pour moi.'
    expect(sample.toLowerCase()).not.toContain('rpe')
    expect(detectDistressLevel(sample)).toBe(0)
  })
})

describe('delete account purge avis_beta', () => {
  it('supprime les avis du compte', async () => {
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
