import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProfileRow } from '../types/database'

/**
 * In-memory Supabase stub with conditional UPDATE semantics
 * (eq / is filters → CAS). First matching writer wins; losers get null.
 */
function createConcurrentSupabaseMock(initial: ProfileRow) {
  let row: ProfileRow = { ...initial }
  let conditionalUpdateCount = 0
  let successfulUpdateCount = 0

  const client = {
    from(_table: string) {
      return {
        update(patch: Record<string, unknown>) {
          const predicates: Array<(r: ProfileRow) => boolean> = []
          const chain = {
            eq(column: string, value: unknown) {
              predicates.push((r) => (r as Record<string, unknown>)[column] === value)
              return chain
            },
            is(column: string, value: null) {
              predicates.push((r) => (r as Record<string, unknown>)[column] === value)
              return chain
            },
            select(_cols?: string) {
              return {
                maybeSingle: async () => {
                  conditionalUpdateCount += 1
                  // Sync check-and-set (JS single-threaded) — models Postgres row lock.
                  const matches = predicates.every((p) => p(row))
                  if (!matches) {
                    return { data: null, error: null }
                  }
                  row = { ...row, ...patch } as ProfileRow
                  successfulUpdateCount += 1
                  return { data: { ...row }, error: null }
                },
                single: async () => ({ data: { ...row }, error: null }),
              }
            },
          }
          return chain
        },
        select(_cols?: string) {
          return {
            eq(_column: string, _value: unknown) {
              return {
                single: async () => ({ data: { ...row }, error: null }),
              }
            },
          }
        },
      }
    },
  }

  return {
    client,
    getRow: () => row,
    stats: () => ({ conditionalUpdateCount, successfulUpdateCount }),
  }
}

function baseProfile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: 'user-concurrent-1',
    pseudo: 'Tester',
    level: 1,
    xp: 0,
    rank: 'Bronze',
    discipline: 'Musculation',
    custom_spots: [],
    active_checkin: null,
    current_streak: 4,
    last_login_date: '2026-08-28',
    avatar_url: null,
    is_ghost_mode_enabled: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-08-28T12:00:00.000Z',
    ...overrides,
  }
}

vi.mock('../lib/supabase', () => ({
  getSupabase: vi.fn(),
}))

describe('applyDailyLoginStreak — concurrence Supabase', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('1–3. deux appels parallèles même user/jour → un seul didUpdate:true, streak +1', async () => {
    const profile = baseProfile({ current_streak: 4, last_login_date: '2026-08-28' })
    const fake = createConcurrentSupabaseMock(profile)
    const { getSupabase } = await import('../lib/supabase')
    vi.mocked(getSupabase).mockReturnValue(fake.client as never)

    const { applyDailyLoginStreak } = await import('./streakService')
    const now = new Date(2026, 7, 29, 10, 0, 0, 0)

    const [a, b] = await Promise.all([
      applyDailyLoginStreak(profile, now),
      applyDailyLoginStreak(profile, now),
    ])

    const winners = [a, b].filter((r) => r.didUpdate)
    const losers = [a, b].filter((r) => !r.didUpdate)

    expect(winners).toHaveLength(1)
    expect(losers).toHaveLength(1)
    expect(winners[0].profile.current_streak).toBe(5)
    expect(winners[0].previousStreak).toBe(4)
    expect(fake.getRow().current_streak).toBe(5)
    expect(fake.getRow().last_login_date).toBe('2026-08-29')
    expect(fake.stats().successfulUpdateCount).toBe(1)
    expect(fake.stats().conditionalUpdateCount).toBe(2)
  })

  it('4. conflit d’écriture → refetch autoritatif + didUpdate:false', async () => {
    const profile = baseProfile({ current_streak: 4, last_login_date: '2026-08-28' })
    // Another device already wrote today before our UPDATE runs.
    const alreadyWritten = baseProfile({
      current_streak: 5,
      last_login_date: '2026-08-29',
    })
    const fake = createConcurrentSupabaseMock(alreadyWritten)
    const { getSupabase } = await import('../lib/supabase')
    vi.mocked(getSupabase).mockReturnValue(fake.client as never)

    const { applyDailyLoginStreak } = await import('./streakService')
    const now = new Date(2026, 7, 29, 10, 0, 0, 0)

    // Caller still thinks last login was yesterday (stale snapshot).
    const result = await applyDailyLoginStreak(profile, now)

    expect(result.didUpdate).toBe(false)
    expect(result.profile.current_streak).toBe(5)
    expect(result.profile.last_login_date).toBe('2026-08-29')
    expect(fake.stats().successfulUpdateCount).toBe(0)
    expect(fake.getRow().current_streak).toBe(5)
  })

  it('5. last_login_date = null → première série à 1, condition IS NULL', async () => {
    const profile = baseProfile({ current_streak: 0, last_login_date: null })
    const fake = createConcurrentSupabaseMock(profile)
    const { getSupabase } = await import('../lib/supabase')
    vi.mocked(getSupabase).mockReturnValue(fake.client as never)

    const { applyDailyLoginStreak } = await import('./streakService')
    const now = new Date(2026, 7, 29, 10, 0, 0, 0)

    const first = await applyDailyLoginStreak(profile, now)
    expect(first.didUpdate).toBe(true)
    expect(first.profile.current_streak).toBe(1)
    expect(first.profile.last_login_date).toBe('2026-08-29')
    expect(first.previousStreak).toBe(0)

    // Second call same day with fresh profile → no update.
    const second = await applyDailyLoginStreak(first.profile, now)
    expect(second.didUpdate).toBe(false)
    expect(second.profile.current_streak).toBe(1)
    expect(fake.stats().successfulUpdateCount).toBe(1)
  })

  it('5b. trois appels parallèles avec last_login_date null → un seul gagnant', async () => {
    const profile = baseProfile({ current_streak: 0, last_login_date: null })
    const fake = createConcurrentSupabaseMock(profile)
    const { getSupabase } = await import('../lib/supabase')
    vi.mocked(getSupabase).mockReturnValue(fake.client as never)

    const { applyDailyLoginStreak } = await import('./streakService')
    const now = new Date(2026, 7, 29, 9, 0, 0, 0)

    const results = await Promise.all([
      applyDailyLoginStreak(profile, now),
      applyDailyLoginStreak(profile, now),
      applyDailyLoginStreak(profile, now),
    ])

    expect(results.filter((r) => r.didUpdate)).toHaveLength(1)
    expect(fake.getRow().current_streak).toBe(1)
    expect(fake.stats().successfulUpdateCount).toBe(1)
  })
})

describe('build — absence du mode preview', () => {
  it('6. aucun branchement streakCelebPreview / PreviewPage dans App ni composants', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const root = path.resolve(__dirname, '..')
    const appSrc = fs.readFileSync(path.join(root, 'App.tsx'), 'utf8')
    expect(appSrc).not.toMatch(/streakCelebPreview/)
    expect(appSrc).not.toMatch(/StreakCelebrationPreview/)
    expect(appSrc).not.toMatch(/PreviewPage/)

    const streakDir = path.join(root, 'components', 'streak')
    const files = fs.existsSync(streakDir) ? fs.readdirSync(streakDir) : []
    expect(files).not.toContain('StreakCelebrationPreviewPage.tsx')
    expect(files).toContain('StreakCelebrationOverlay.tsx')
  })
})
