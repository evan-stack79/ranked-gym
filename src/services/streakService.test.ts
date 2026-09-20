import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  asDateKey,
  clearStreakCelebrationGuard,
  computeStreakTransition,
  formatStreakDaysLabel,
  getStreakStatusMessage,
  getWeekStripDays,
  hasCelebratedStreak,
  isStreakMilestone,
  localDateKey,
  markStreakCelebrated,
  startOfLocalWeek,
  yesterdayDateKey,
} from './streakService'

/** Local noon helper — avoids DST edge cases around midnight. */
function localAt(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min, 0, 0)
}

describe('streakService — local dates', () => {
  it('localDateKey / yesterdayDateKey use local calendar, not UTC slice', () => {
    // Late evening local — still the local calendar day.
    const late = localAt(2026, 3, 15, 23, 30)
    expect(localDateKey(late)).toBe('2026-03-15')
    expect(yesterdayDateKey(late)).toBe('2026-03-14')
  })

  it('asDateKey normalizes DATE / ISO and rejects garbage', () => {
    expect(asDateKey('2026-08-29')).toBe('2026-08-29')
    expect(asDateKey('2026-08-29T22:00:00.000Z')?.length).toBe(10)
    expect(asDateKey(null)).toBeNull()
    expect(asDateKey('')).toBeNull()
    expect(asDateKey('not-a-date')).toBeNull()
  })
})

describe('computeStreakTransition — daily open rules (injectable clock)', () => {
  const now = localAt(2026, 8, 29, 10)

  it('1. première utilisation → série à 1, celebrate', () => {
    const t = computeStreakTransition(null, 0, now)
    expect(t).toMatchObject({
      nextStreak: 1,
      previousStreak: 0,
      didUpdate: true,
      shouldCelebrate: true,
      today: '2026-08-29',
    })
  })

  it('2. ouverture le lendemain → +1', () => {
    const t = computeStreakTransition('2026-08-28', 4, now)
    expect(t.nextStreak).toBe(5)
    expect(t.didUpdate).toBe(true)
    expect(t.shouldCelebrate).toBe(true)
  })

  it('3–5. même jour (reload / onglet / foreground) → aucune hausse', () => {
    const t = computeStreakTransition('2026-08-29', 5, now)
    expect(t.nextStreak).toBe(5)
    expect(t.didUpdate).toBe(false)
    expect(t.shouldCelebrate).toBe(false)
  })

  it('6. retour après minuit local → +1', () => {
    const afterMidnight = localAt(2026, 8, 30, 0, 5)
    const t = computeStreakTransition('2026-08-29', 5, afterMidnight)
    expect(t.today).toBe('2026-08-30')
    expect(t.nextStreak).toBe(6)
    expect(t.shouldCelebrate).toBe(true)
  })

  it('7. journée manquée → reset à 1 (pas celebrate N→N+1 si gap)', () => {
    const t = computeStreakTransition('2026-08-26', 12, now)
    expect(t.nextStreak).toBe(1)
    expect(t.didUpdate).toBe(true)
    // 12 → 1 n’est pas N→N+1
    expect(t.shouldCelebrate).toBe(false)
  })

  it('corrupt previous streak → fallback sûr (0)', () => {
    const t = computeStreakTransition(null, Number.NaN, now)
    expect(t.previousStreak).toBe(0)
    expect(t.nextStreak).toBe(1)
    expect(t.shouldCelebrate).toBe(true)
  })

  it('week bonus uniquement sur multiple de 7', () => {
    expect(computeStreakTransition('2026-08-28', 6, now).weekBonus).toBe(true)
    expect(computeStreakTransition('2026-08-28', 6, now).bonusXp).toBe(500)
    expect(computeStreakTransition('2026-08-28', 5, now).weekBonus).toBe(false)
  })

  it('idempotent : deux appels même jour = second sans update', () => {
    const first = computeStreakTransition('2026-08-28', 3, now)
    expect(first.nextStreak).toBe(4)
    const second = computeStreakTransition(first.today, first.nextStreak, now)
    expect(second.didUpdate).toBe(false)
    expect(second.nextStreak).toBe(4)
  })
})

describe('celebration guard — isolation compte + anti-replay', () => {
  const store = new Map<string, string>()

  beforeEach(() => {
    store.clear()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('8. changement de compte → isolation (clés séparées)', () => {
    markStreakCelebrated('user-a', '2026-08-29', 5)
    expect(hasCelebratedStreak('user-a', '2026-08-29', 5)).toBe(true)
    expect(hasCelebratedStreak('user-b', '2026-08-29', 5)).toBe(false)
    expect(hasCelebratedStreak('anon', '2026-08-29', 5)).toBe(false)
  })

  it('10–11. animation seulement après incrément, pas rejouée le même jour', () => {
    const dateKey = '2026-08-29'
    const t = computeStreakTransition('2026-08-28', 12, localAt(2026, 8, 29))
    expect(t.shouldCelebrate).toBe(true)

    expect(hasCelebratedStreak('u1', dateKey, t.nextStreak)).toBe(false)
    markStreakCelebrated('u1', dateKey, t.nextStreak)
    expect(hasCelebratedStreak('u1', dateKey, t.nextStreak)).toBe(true)

    // Reload même jour : transition sans update → pas de célébration
    const again = computeStreakTransition(dateKey, t.nextStreak, localAt(2026, 8, 29))
    expect(again.shouldCelebrate).toBe(false)
    expect(hasCelebratedStreak('u1', dateKey, t.nextStreak)).toBe(true)
  })

  it('9. donnée corrompue dans localStorage → fallback sûr', () => {
    store.set('ranked-gym:streak-celebration:u:bad', '{not-json')
    expect(hasCelebratedStreak('bad', '2026-08-29', 1)).toBe(false)
    markStreakCelebrated('bad', '2026-08-29', 1)
    expect(hasCelebratedStreak('bad', '2026-08-29', 1)).toBe(true)
  })

  it('userId vide → treat as already celebrated (ne lance pas)', () => {
    expect(hasCelebratedStreak('', '2026-08-29', 1)).toBe(true)
  })

  it('clearStreakCelebrationGuard remet à zéro', () => {
    markStreakCelebrated('u2', '2026-08-29', 3)
    clearStreakCelebrationGuard('u2')
    expect(hasCelebratedStreak('u2', '2026-08-29', 3)).toBe(false)
  })
})

describe('week strip + messages', () => {
  it('12. jours de semaine locaux L→D, portion réelle de la série', () => {
    // Vendredi 28 août 2026
    const friday = localAt(2026, 8, 28, 15)
    expect(localDateKey(friday)).toBe('2026-08-28')
    const monday = startOfLocalWeek(friday)
    expect(localDateKey(monday)).toBe('2026-08-24')

    const days = getWeekStripDays(3, friday)
    expect(days).toHaveLength(7)
    expect(days.map((d) => d.label).join('')).toBe('LMMJVSD')
    // today = vendredi (index 4)
    expect(days[4].isToday).toBe(true)
    // streak 3 → mercredi, jeudi, vendredi couverts
    expect(days.map((d) => d.isCovered)).toEqual([
      false,
      false,
      true,
      true,
      true,
      false,
      false,
    ])
    // jamais de jours futurs
    expect(days[5].isCovered).toBe(false)
    expect(days[6].isCovered).toBe(false)
  })

  it('ne marque pas de jours hors série même si streak long hors semaine', () => {
    const monday = localAt(2026, 8, 24, 9)
    const days = getWeekStripDays(1, monday)
    expect(days[0].isCovered).toBe(true)
    expect(days.slice(1).every((d) => !d.isCovered)).toBe(true)
  })

  it('messages factuels (pas culpabilisants)', () => {
    expect(getStreakStatusMessage(1)).toBe('Ta nouvelle série commence aujourd’hui.')
    expect(getStreakStatusMessage(3)).toMatch(/Encore 4 jours/)
    expect(getStreakStatusMessage(6)).toMatch(/Encore 1 jour /)
    expect(getStreakStatusMessage(7)).toBe('1 semaine consécutive.')
    expect(getStreakStatusMessage(14)).toBe('2 semaines consécutives.')
    expect(getStreakStatusMessage(10)).toMatch(/10 jours consécutifs/)
  })

  it('formatStreakDaysLabel gère le singulier', () => {
    expect(formatStreakDaysLabel(1)).toBe('1 jour de série')
    expect(formatStreakDaysLabel(13)).toBe('13 jours de série')
  })
})

describe('isStreakMilestone — panthère', () => {
  it('13–15. absente à 6, présente à 7/30/100/365, aucun palier inventé', () => {
    expect(isStreakMilestone(6)).toBe(false)
    expect(isStreakMilestone(7)).toBe(true)
    expect(isStreakMilestone(8)).toBe(false)
    expect(isStreakMilestone(30)).toBe(true)
    expect(isStreakMilestone(100)).toBe(true)
    expect(isStreakMilestone(365)).toBe(true)
    expect(isStreakMilestone(29)).toBe(false)
    expect(isStreakMilestone(50)).toBe(false)
    expect(isStreakMilestone(364)).toBe(false)
    expect(isStreakMilestone(0)).toBe(false)
  })
})

describe('shouldCelebrate gate (animation uniquement N→N+1)', () => {
  const now = localAt(2026, 8, 29)

  it('0→1 celebrate ; gap reset non-celebrate ; same day non-celebrate', () => {
    expect(computeStreakTransition(null, 0, now).shouldCelebrate).toBe(true)
    expect(computeStreakTransition('2026-08-20', 40, now).shouldCelebrate).toBe(false)
    expect(computeStreakTransition('2026-08-29', 40, now).shouldCelebrate).toBe(false)
    expect(computeStreakTransition('2026-08-28', 6, now).shouldCelebrate).toBe(true)
  })
})
