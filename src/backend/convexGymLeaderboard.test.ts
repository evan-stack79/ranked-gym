import { afterEach, describe, expect, it } from 'vitest'
import { hashToken } from '../../convex/lib/authCrypto'
import {
  consumeGoogleSearchQuota,
  createManualGymForSession,
  deleteGymLeaderboardDataForUser,
  ensureGoogleGymPlace,
  GOOGLE_PLACES_API_KEY_ENV,
  GOOGLE_SEARCH_DAILY_LIMIT,
  joinGymLeaderboardForSession,
  leaveGymLeaderboardForSession,
  purgeExpiredGoogleGymLocations,
  purgeExpiredGymVisitDays,
  recomputeGymPeriodScores,
  recordGymVisitDayForSession,
  setLocationConsentForSession,
  GYM_VISIT_TOO_OLD,
} from '../../convex/gymLeaderboard'
import {
  countPointsFromVisitDateKeys,
  denseRankEntries,
  formatDateKeyUtc,
  GOOGLE_LOC_RETENTION_DAYS,
  VISIT_RETENTION_DAYS,
  weekKeyFromDateKey,
} from '../../convex/gymLeaderboardLogic'
import {
  getGooglePlacesApiKey,
  isGooglePlacesSearchEnabled,
  runPlacesAutocompleteForUser,
} from '../../convex/gymPlacesGoogle'
import { deleteAccountAndUserData } from '../../convex/auth'
import { hashPassword } from '../../convex/lib/authCrypto'

type TableName =
  | 'auth_users'
  | 'auth_password_credentials'
  | 'auth_sessions'
  | 'nutrition_state'
  | 'gym_places'
  | 'gym_memberships'
  | 'gym_visit_days'
  | 'gym_leaderboard_snapshots'
  | 'gym_places_search_daily'
  | 'gym_moderation_reports'
  | 'rate_limit_buckets'
  | 'profiles'
  | 'workouts_state'
  | 'sleep_nights'
  | 'checkins'
  | 'custom_spots'
  | 'active_checkins'
  | 'aliments'
  | 'activities'
  | 'activity_comments'
  | 'activity_reactions'
  | 'user_blocks'
  | 'user_follows'
  | 'ai_usage_limits'
  | 'streak_state'
  | 'legacy_supabase_backups'
  | 'auth_private_notes'
  | 'avis_beta'
  | 'user_files'
  | 'auth_password_reset_outbox'
  | 'auth_password_reset_tokens'

type StoredRow = Record<string, unknown> & { _id: string }

class FakeDb {
  private idCounter = 1
  private rows: Record<string, StoredRow[]> = {}

  private tableRows(table: string): StoredRow[] {
    if (!this.rows[table]) this.rows[table] = []
    return this.rows[table]!
  }

  insert(table: TableName, value: Record<string, unknown>) {
    const row = { _id: `${table}:${(this.idCounter += 1)}`, ...value }
    this.tableRows(table).push(row)
    return Promise.resolve(row._id)
  }

  query(table: TableName) {
    return new FakeQuery(this.tableRows(table))
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

  table(name: TableName): StoredRow[] {
    return this.tableRows(name)
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
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => unknown
      }
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
  return {
    db,
    storage: { delete: async () => undefined },
  }
}

async function seedUser(
  db: FakeDb,
  userId: string,
  sessionToken: string,
  opts?: { age?: number; password?: string },
) {
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
  await db.insert('nutrition_state', {
    userId,
    profileJson: { age: opts?.age ?? 28 },
    journalJson: {},
    updatedAt: now,
  })
  if (opts?.password) {
    await db.insert('auth_password_credentials', {
      userId,
      passwordHash: await hashPassword(opts.password),
      updatedAt: now,
    })
  }
}

async function seedManualGym(db: FakeDb, gymKey: string, now = Date.now()) {
  await db.insert('gym_places', {
    gymKey,
    source: 'manual',
    manualName: 'Salle Exemple',
    manualCity: 'Tergnier',
    lat: 49.655,
    lng: 3.3,
    pointSetAt: now,
    createdAt: now,
    updatedAt: now,
  })
}

describe('Convex gym leaderboard — server limits', () => {
  it('enforces max 1 visit per day per gym even with duplicate / multi-device sends', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const token = 'sess-a'
    const now = Date.parse('2026-10-08T12:00:00Z')
    await seedUser(db, 'u1', token)
    await seedManualGym(db, 'manual:g1', now)
    await joinGymLeaderboardForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g1',
      pseudo: 'Lucie',
      now,
    })
    await setLocationConsentForSession(ctx as never, {
      sessionToken: token,
      consent: true,
      now,
    })

    const first = await recordGymVisitDayForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g1',
      dateKey: '2026-10-08',
      presenceValidated: true,
      now,
    })
    const second = await recordGymVisitDayForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g1',
      dateKey: '2026-10-08',
      presenceValidated: true,
      now: now + 1000,
    })
    const third = await recordGymVisitDayForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g1',
      dateKey: '2026-10-08',
      presenceValidated: true,
      now: now + 2000,
    })

    expect(first).toEqual({ ok: true, counted: true, duplicate: false })
    expect(second).toEqual({ ok: true, counted: false, duplicate: true })
    expect(third).toEqual({ ok: true, counted: false, duplicate: true })
    expect(db.table('gym_visit_days')).toHaveLength(1)
  })

  it('server counts max 2 per week itself when recomputing (offline backlog)', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const token = 'sess-b'
    const now = Date.parse('2026-10-10T12:00:00Z')
    await seedUser(db, 'u2', token)
    await seedManualGym(db, 'manual:g2', now)
    await joinGymLeaderboardForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g2',
      pseudo: 'Sam',
      now,
    })
    await setLocationConsentForSession(ctx as never, {
      sessionToken: token,
      consent: true,
      now,
    })

    for (const dateKey of [
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
    ]) {
      await recordGymVisitDayForSession(ctx as never, {
        sessionToken: token,
        gymKey: 'manual:g2',
        dateKey,
        presenceValidated: true,
        now,
      })
    }

    const weekKey = weekKeyFromDateKey('2026-10-08')
    await recomputeGymPeriodScores(ctx as never, {
      gymKey: 'manual:g2',
      period: 'week',
      periodKey: weekKey,
      now,
    })
    const snaps = db.table('gym_leaderboard_snapshots')
    expect(snaps).toHaveLength(1)
    expect(snaps[0]!.points).toBe(2)

    const dateKeys = db.table('gym_visit_days').map((r) => String(r.dateKey))
    expect(countPointsFromVisitDateKeys(dateKeys)).toBe(2)
  })

  it('rejects a session arriving more than 7 days late', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const token = 'sess-late'
    const now = Date.parse('2026-10-08T12:00:00Z')
    await seedUser(db, 'u3', token)
    await seedManualGym(db, 'manual:g3', now)
    await joinGymLeaderboardForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g3',
      pseudo: 'Late',
      now,
    })
    await setLocationConsentForSession(ctx as never, {
      sessionToken: token,
      consent: true,
      now,
    })

    const result = await recordGymVisitDayForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g3',
      dateKey: '2026-09-20',
      presenceValidated: true,
      now,
    })
    expect(result).toEqual({ ok: false, error: GYM_VISIT_TOO_OLD })
    expect(db.table('gym_visit_days')).toHaveLength(0)
  })

  it('ties share dense rank with no load/volume/time break', async () => {
    const ranked = denseRankEntries([
      { userId: '1', pseudo: 'A', points: 8 },
      { userId: '2', pseudo: 'B', points: 8 },
      { userId: '3', pseudo: 'C', points: 7 },
    ])
    expect(ranked.map((r) => r.rank)).toEqual([1, 1, 2])
  })

  it('leaving the leaderboard deletes the user leaderboard data', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const token = 'sess-leave'
    const now = Date.parse('2026-10-08T12:00:00Z')
    await seedUser(db, 'u4', token)
    await seedManualGym(db, 'manual:g4', now)
    await joinGymLeaderboardForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g4',
      pseudo: 'Quit',
      now,
    })
    await setLocationConsentForSession(ctx as never, {
      sessionToken: token,
      consent: true,
      now,
    })
    await recordGymVisitDayForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g4',
      dateKey: '2026-10-08',
      presenceValidated: true,
      now,
    })
    await recomputeGymPeriodScores(ctx as never, {
      gymKey: 'manual:g4',
      period: 'week',
      periodKey: weekKeyFromDateKey('2026-10-08'),
      now,
    })
    expect(db.table('gym_memberships').length).toBe(1)
    expect(db.table('gym_visit_days').length).toBe(1)
    expect(db.table('gym_leaderboard_snapshots').length).toBe(1)

    const left = await leaveGymLeaderboardForSession(ctx as never, { sessionToken: token })
    expect(left.ok).toBe(true)
    expect(db.table('gym_memberships')).toHaveLength(0)
    expect(db.table('gym_visit_days')).toHaveLength(0)
    expect(db.table('gym_leaderboard_snapshots')).toHaveLength(0)
  })

  it('account deletion also deletes leaderboard data', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const token = 'sess-del'
    const password = 'DeleteMe1!'
    const now = Date.parse('2026-10-08T12:00:00Z')
    await seedUser(db, 'u5', token, { password })
    await seedManualGym(db, 'manual:g5', now)
    await joinGymLeaderboardForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g5',
      pseudo: 'Gone',
      now,
    })
    await setLocationConsentForSession(ctx as never, {
      sessionToken: token,
      consent: true,
      now,
    })
    await recordGymVisitDayForSession(ctx as never, {
      sessionToken: token,
      gymKey: 'manual:g5',
      dateKey: '2026-10-08',
      presenceValidated: true,
      now,
    })

    await deleteAccountAndUserData(ctx as never, { sessionToken: token, password })
    expect(db.table('gym_memberships')).toHaveLength(0)
    expect(db.table('gym_visit_days')).toHaveLength(0)
    expect(db.table('auth_users').every((u) => u.userId !== 'u5' || u.deletedAt)).toBeTruthy()
  })

  it('purges visit days after 60 days and Google lat/lng after 30 days', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const now = Date.parse('2026-10-08T12:00:00Z')
    const today = formatDateKeyUtc(new Date(now))
    const oldVisit = (() => {
      const d = new Date(now)
      d.setUTCDate(d.getUTCDate() - (VISIT_RETENTION_DAYS + 1))
      return formatDateKeyUtc(d)
    })()

    await db.insert('gym_visit_days', {
      userId: 'u6',
      gymKey: 'google:place1',
      dateKey: oldVisit,
      createdAt: now - (VISIT_RETENTION_DAYS + 1) * 86_400_000,
    })
    await db.insert('gym_visit_days', {
      userId: 'u6',
      gymKey: 'google:place1',
      dateKey: today,
      createdAt: now,
    })
    await db.insert('gym_places', {
      gymKey: 'google:place1',
      source: 'google',
      googlePlaceId: 'place1',
      lat: 48.8,
      lng: 2.3,
      locFetchedAt: now - (GOOGLE_LOC_RETENTION_DAYS + 1) * 86_400_000,
      createdAt: now,
      updatedAt: now,
    })

    const visits = await purgeExpiredGymVisitDays(ctx as never, { now })
    expect(visits.deleted).toBe(1)
    expect(db.table('gym_visit_days')).toHaveLength(1)
    expect(db.table('gym_visit_days')[0]!.dateKey).toBe(today)

    const locs = await purgeExpiredGoogleGymLocations(ctx as never, { now })
    expect(locs.cleared).toBe(1)
    const place = db.table('gym_places')[0]!
    expect(place.lat).toBeNull()
    expect(place.lng).toBeNull()
  })
})

describe('Google Places search gate', () => {
  const prev = process.env[GOOGLE_PLACES_API_KEY_ENV]

  afterEach(() => {
    if (prev === undefined) delete process.env[GOOGLE_PLACES_API_KEY_ENV]
    else process.env[GOOGLE_PLACES_API_KEY_ENV] = prev
  })

  it('is disabled without GOOGLE_PLACES_API_KEY', () => {
    delete process.env[GOOGLE_PLACES_API_KEY_ENV]
    expect(getGooglePlacesApiKey()).toBeNull()
    expect(isGooglePlacesSearchEnabled()).toBe(false)
  })

  it('rate-limits at 20 searches/user/day with key (mock fetch)', async () => {
    process.env[GOOGLE_PLACES_API_KEY_ENV] = 'test-key-not-real'
    const db = new FakeDb()
    const ctx = createCtx(db)
    const userId = 'u-search'
    const dateKey = '2026-10-08'
    let fetches = 0
    const fetchImpl = async () => {
      fetches += 1
      return new Response(JSON.stringify({ suggestions: [] }), { status: 200 })
    }

    for (let i = 0; i < GOOGLE_SEARCH_DAILY_LIMIT; i += 1) {
      const result = await runPlacesAutocompleteForUser({
        userId,
        input: 'bas',
        sessionTokenPlaces: `tok-${i}`,
        dateKey,
        consumeQuota: () => consumeGoogleSearchQuota(ctx as never, { userId, dateKey, now: Date.now() }),
        fetchImpl: fetchImpl as typeof fetch,
      })
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.enabled).toBe(true)
    }

    const blocked = await runPlacesAutocompleteForUser({
      userId,
      input: 'bas',
      sessionTokenPlaces: 'tok-over',
      dateKey,
      consumeQuota: () => consumeGoogleSearchQuota(ctx as never, { userId, dateKey, now: Date.now() }),
      fetchImpl: fetchImpl as typeof fetch,
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.error).toBe('RATE_LIMIT')
      expect(blocked.limit).toBe(20)
    }
    expect(fetches).toBe(GOOGLE_SEARCH_DAILY_LIMIT)
  })

  it('ensureGoogleGym stores place id + lat/lng, never name', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const now = Date.now()
    const { gymKey } = await ensureGoogleGymPlace(ctx as never, {
      placeId: 'ChIJtest',
      lat: 48.85,
      lng: 2.35,
      now,
    })
    expect(gymKey).toBe('google:ChIJtest')
    const row = db.table('gym_places')[0]!
    expect(row.googlePlaceId).toBe('ChIJtest')
    expect(row.lat).toBe(48.85)
    expect(row).not.toHaveProperty('manualName')
    expect(Object.keys(row).some((k) => k.toLowerCase().includes('address'))).toBe(false)
  })

  it('createManualGym stores moderated name + city', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    const token = 'sess-manual'
    await seedUser(db, 'u-manual', token)
    const created = await createManualGymForSession(ctx as never, {
      sessionToken: token,
      name: 'Basic Fit',
      city: 'Tergnier',
    })
    expect(created.ok).toBe(true)
    if (created.ok) {
      expect(created.displayName).toContain('Tergnier')
      expect(db.table('gym_places')[0]!.source).toBe('manual')
    }
  })
})

describe('deleteGymLeaderboardDataForUser helper', () => {
  it('clears search quota and reports too', async () => {
    const db = new FakeDb()
    const ctx = createCtx(db)
    await db.insert('gym_memberships', {
      userId: 'ux',
      gymKey: 'manual:x',
      pseudo: 'X',
      joinedAt: 1,
      lastGymChangeAt: 1,
      locationConsent: false,
      createdAt: 1,
      updatedAt: 1,
    })
    await db.insert('gym_places_search_daily', {
      userId: 'ux',
      dateKey: '2026-10-08',
      count: 3,
      updatedAt: 1,
    })
    await db.insert('gym_moderation_reports', {
      reporterUserId: 'ux',
      targetKind: 'pseudo',
      targetKey: 'bad',
      createdAt: 1,
    })
    await deleteGymLeaderboardDataForUser(ctx as never, 'ux')
    expect(db.table('gym_memberships')).toHaveLength(0)
    expect(db.table('gym_places_search_daily')).toHaveLength(0)
    expect(db.table('gym_moderation_reports')).toHaveLength(0)
  })
})
