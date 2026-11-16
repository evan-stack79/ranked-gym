import { describe, expect, it } from 'vitest'
import {
  ACCOUNT_DELETE_AGE_MAJORITY_RESULT,
  ACCOUNT_DELETE_RANKED_USER_TABLES,
  deleteAccountAndUserData,
  NUTRITION_DELETE_BATCH_SIZE,
  NUTRITION_USER_CHILD_TABLES,
  purgeNutritionUserDataBatch,
} from '../../convex/auth'
import { hashPassword, hashToken } from '../../convex/lib/authCrypto'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {
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
    avis_beta: [],
  }

  private ensure(table: string): StoredRow[] {
    if (!this.rows[table]) this.rows[table] = []
    return this.rows[table]
  }

  insert(table: string, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.ensure(table).push(row)
    return Promise.resolve(row._id)
  }

  query(table: string) {
    return new FakeQuery(this.ensure(table))
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
    for (const key of Object.keys(this.rows)) {
      const idx = this.rows[key]!.findIndex((row) => row._id === id)
      if (idx === -1) continue
      this.rows[key]!.splice(idx, 1)
      return Promise.resolve()
    }
    return Promise.resolve()
  }

  table(name: string): StoredRow[] {
    return this.ensure(name)
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

describe('account deletion — hydration / ranked / rewards / archives', () => {
  it('erases hydration, ranked, wallet and keeps anonymized purchase archives', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await seedUser(db, 'user-a', 'password-a', 'session-a')
    await seedUser(db, 'user-b', 'password-b', 'session-b')
    const now = Date.now()

    for (const userId of ['user-a', 'user-b'] as const) {
      await db.insert('hydrationSettings', {
        userId,
        mode: 'classic_15',
        goalMl: 1500,
        myBottleHasShape: false,
        remindersEnabled: false,
        reminderTimes: [],
        updatedAt: now,
      })
      await db.insert('hydrationEntries', {
        userId,
        dayKey: '2026-11-15',
        amountMl: 250,
        source: 'glass',
        clientId: `c-${userId}`,
        createdAt: now,
      })
      await db.insert('rankedOptIn', {
        userId,
        forceEnabled: true,
        disciplineEnabled: true,
        optedInAt: now,
        ageGatePassedAt: now,
        sex: 'unknown',
      })
      await db.insert('rankedLiftLog', {
        userId,
        canonicalExerciseId: 'squat',
        weightKg: 100,
        reps: 5,
        status: 'declared',
        anomalyFlag: 'none',
        createdAt: now,
      })
      await db.insert('rankedVerifiedPr', {
        userId,
        canonicalExerciseId: 'squat',
        estimated1RmKg: 120,
        liftLogId: 'rankedLiftLog:x',
        verifiedAt: now,
        cycleId: 'rankedCycle:x',
      })
      await db.insert('rankedForceScore', {
        userId,
        cycleId: 'rankedCycle:x',
        score: 10,
        breakdown: { squat: 10, bench: 0, deadlift: 0, barbell_row: 0, ohp: 0 },
        leagueId: 'rankedLeague:x',
        updatedAt: now,
      })
      await db.insert('rankedDisciplineScore', {
        userId,
        cycleId: 'rankedCycle:x',
        sessionsLast7d: 2,
        streakWeeks: 1,
        score: 4,
        updatedAt: now,
      })
      await db.insert('rankedSessionCompletion', {
        userId,
        completedAt: now,
      })
      await db.insert('rewardsWallet', {
        userId,
        cycleId: 'rankedCycle:x',
        balance: 40,
        earnedToday: 0,
        earnedTodayDate: '2026-11-15',
        earnedThisCycle: 40,
        updatedAt: now,
      })
      await db.insert('rewardsLedger', {
        userId,
        cycleId: 'rankedCycle:x',
        delta: 10,
        reason: 'discipline_session',
        createdAt: now,
        balanceAfter: 10,
      })
    }

    await db.insert('rankedFriendship', {
      userA: 'user-a',
      userB: 'user-b',
      status: 'accepted',
      requestedBy: 'user-a',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('rankedVerifyRequest', {
      liftLogId: 'rankedLiftLog:x',
      ownerId: 'user-a',
      method: 'friend_18',
      friendId: 'user-b',
      createdAt: now,
      expiresAt: now + 86_400_000,
      status: 'open',
    })

    const partnerId = await db.insert('rewardsPartner', {
      slug: 'decathlon',
      name: 'Decathlon',
      active: true,
    })
    const itemId = await db.insert('rewardsCatalogItem', {
      partnerId,
      categoryId: 'RP-CAT-01',
      title: 'Bon',
      costPoints: 30,
      stockLogical: 9,
      active: true,
      availableFrom: now,
      sortOrder: 1,
    })
    const redemptionId = await db.insert('rewardsRedemptionCode', {
      code: 'RG-KEEPME',
      userId: 'user-a',
      itemId,
      costPoints: 30,
      status: 'consumed',
      cycleId: 'rankedCycle:x',
      createdAt: now,
      expiresAt: now + 86_400_000,
      consumedAt: now,
    })
    await db.insert('rewardsLedger', {
      userId: 'user-a',
      cycleId: 'rankedCycle:x',
      delta: -30,
      reason: 'redeem',
      refId: String(redemptionId),
      createdAt: now,
      balanceAfter: 10,
    })

    await db.insert('subscriptionReceipts', {
      userId: 'user-a',
      offerKey: 'solo_monthly',
      productId: 'ranked_pro_solo_monthly',
      priceDisplay: '9,99 €',
      firstChargeAmountDisplay: '9,99 €',
      withdrawalConsentAt: now,
      legalVersionL05: 'L05',
      cancelUrl: 'https://apps.apple.com/account/subscriptions',
      createdAt: now,
      firstChargeAt: now,
    })
    await db.insert('subscriptions', {
      userId: 'user-a',
      source: 'apple',
      environment: 'production',
      storeChainKey: 'chain-a',
      latestTransactionId: 'tx-apple-a',
      productId: 'ranked_pro_solo_monthly',
      plan: 'solo',
      seatLimit: 1,
      billingPeriod: 'month',
      status: 'active',
      autoRenew: true,
      isTrial: false,
      billingRetry: false,
      verifiedAt: now,
      updatedAt: now,
      revision: 1,
      periodEndsAt: now + 30 * 86_400_000,
      purchaseTokenEncrypted: 'secret-token-must-not-archive',
    })
    await db.insert('subscriptionUserProfiles', {
      userId: 'user-a',
      dateOfBirth: '1990-01-01',
      createdAt: now,
      updatedAt: now,
    })
    await db.insert('proEntitlements', {
      userId: 'user-a',
      activeUntil: now + 86_400_000,
      updatedAt: now,
    })
    await db.insert('nutrition_age_majority_audit', {
      userId: 'user-a',
      at: now - 1000,
    })
    await db.insert('auth_google_takeover_audit', {
      userId: 'user-a',
      at: now - 2000,
    })
    await db.insert('nutrition_safety_clear_audit', {
      userId: 'user-a',
      at: now,
    })
    await db.insert('food_search_usage', {
      userId: 'user-a',
      dateKey: '2026-11-15',
      searchCount: 2,
      updatedAt: now,
    })
    await db.insert('surveillance_fitness_events', {
      userId: 'user-a',
      email: 'a@example.com',
      type: 'signup_free',
      plan: 'free',
      notif: 'envoyee',
      notifEssais: 1,
      createdAt: now,
      updatedAt: now,
    })

    await deleteAccountAndUserData(ctx as never, {
      sessionToken: 'session-a',
      password: 'password-a',
    })

    for (const table of [
      'hydrationSettings',
      'hydrationEntries',
      'rankedOptIn',
      'rankedLiftLog',
      'rankedVerifiedPr',
      'rankedForceScore',
      'rankedDisciplineScore',
      'rankedSessionCompletion',
      'rewardsWallet',
      'rewardsLedger',
      'rewardsRedemptionCode',
      'proEntitlements',
      'subscriptionUserProfiles',
      'subscriptionReceipts',
      'subscriptions',
      'nutrition_safety_clear_audit',
      'food_search_usage',
      'surveillance_fitness_events',
      'nutrition_age_majority_audit',
      'auth_google_takeover_audit',
    ] as const) {
      expect(db.table(table).filter((r) => r.userId === 'user-a'), table).toHaveLength(0)
    }
    expect(db.table('rankedFriendship')).toHaveLength(0)
    expect(db.table('rankedVerifyRequest')).toHaveLength(0)

    expect(db.table('hydrationSettings').filter((r) => r.userId === 'user-b')).toHaveLength(1)
    expect(db.table('rankedOptIn').filter((r) => r.userId === 'user-b')).toHaveLength(1)
    expect(db.table('rewardsWallet').filter((r) => r.userId === 'user-b')).toHaveLength(1)

    const receiptArchives = db.table('account_delete_subscription_archive')
    expect(receiptArchives.length).toBeGreaterThan(0)
    const archivedJson = JSON.stringify(receiptArchives)
    expect(archivedJson).not.toMatch(/user-a/)
    expect(archivedJson).not.toMatch(/a@example.com/)
    expect(archivedJson).not.toMatch(/1990-01-01/)
    expect(archivedJson).not.toMatch(/secret-token-must-not-archive/)
    expect(receiptArchives.some((r) => r.userId != null)).toBe(false)
    expect(receiptArchives.some((r) => r.productId === 'ranked_pro_solo_monthly')).toBe(true)
    expect(receiptArchives.some((r) => r.storeTransactionId === 'tx-apple-a')).toBe(true)
    expect(receiptArchives.some((r) => r.amount === '9,99 €')).toBe(true)
    expect(receiptArchives.some((r) => r.store === 'apple')).toBe(true)

    const rewardArchives = db.table('account_delete_rewards_redemption_archive')
    expect(rewardArchives).toHaveLength(1)
    expect(rewardArchives[0]).toMatchObject({
      code: 'RG-KEEPME',
      partner: 'Decathlon',
      points: 30,
    })
    expect(rewardArchives[0]?.userId).toBeUndefined()

    const ageArchives = db.table('account_delete_age_majority_archive')
    expect(ageArchives).toHaveLength(1)
    expect(ageArchives[0]?.result).toBe(ACCOUNT_DELETE_AGE_MAJORITY_RESULT)
    expect(ageArchives[0]?.userId).toBeUndefined()

    const takeoverArchives = db.table('account_delete_google_takeover_archive')
    expect(takeoverArchives).toHaveLength(1)
    expect(JSON.stringify(takeoverArchives[0])).not.toMatch(/password|token/i)
  })

  it('lists every ranked* user-scoped table except friendship / verify (handled à part)', () => {
    const rankedUserTablesInSchema = [
      'rankedOptIn',
      'rankedLiftLog',
      'rankedVerifiedPr',
      'rankedForceScore',
      'rankedDisciplineScore',
      'rankedSessionCompletion',
    ]
    const listed = ACCOUNT_DELETE_RANKED_USER_TABLES.map((t) => t.table)
    for (const table of rankedUserTablesInSchema) {
      expect(listed.includes(table as never), `ranked table oubliée: ${table}`).toBe(true)
    }
  })
})
