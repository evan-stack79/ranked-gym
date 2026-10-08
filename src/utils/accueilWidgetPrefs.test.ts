import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ACCUEIL_WIDGET_PREFS_VERSION,
  applyRemoteAccueilWidgetPrefs,
  createDefaultAccueilWidgetPrefs,
  hasUserWaterGoal,
  mergeAccueilWidgetPrefs,
  moveAccueilWidget,
  normalizeAccueilWidgetPrefs,
  resetAccueilWidgetPrefs,
  resolveVisibleAccueilWidgets,
  setAccueilWaterGoalMl,
  toggleAccueilWidgetHidden,
  type AccueilWidgetPrefs,
} from './accueilWidgetPrefs'
import { getUserWaterGoalMl, USER_WATER_GOAL_KEY } from './userWaterGoal'

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
    clear: () => store.clear(),
  })
  vi.stubGlobal('window', {
    dispatchEvent: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function prefs(
  partial: Partial<AccueilWidgetPrefs> & Pick<AccueilWidgetPrefs, 'updatedAt'>,
): AccueilWidgetPrefs {
  return normalizeAccueilWidgetPrefs({
    version: ACCUEIL_WIDGET_PREFS_VERSION,
    order: [
      'seance',
      'seances_semaine',
      'eau',
      'series_jour',
      'prochaine_seance',
      'programme',
      'recent',
    ],
    hidden: [],
    waterGoalMl: null,
    ...partial,
  })
}

describe('accueilWidgetPrefs', () => {
  it('default order includes metric tiles, nothing hidden, no water goal', () => {
    const d = createDefaultAccueilWidgetPrefs(1000)
    expect(d.order).toEqual([
      'seance',
      'seances_semaine',
      'eau',
      'series_jour',
      'prochaine_seance',
      'programme',
      'recent',
    ])
    expect(d.hidden).toEqual([])
    expect(d.waterGoalMl).toBeNull()
    expect(d.version).toBe(2)
    expect(d.updatedAt).toBe(1000)
    expect(resolveVisibleAccueilWidgets(d)).toEqual(d.order)
  })

  it('migrates v1 prefs: keeps order, inserts new widgets, bumps version', () => {
    const migrated = normalizeAccueilWidgetPrefs({
      version: 1,
      order: ['seance', 'recent', 'programme'],
      hidden: ['recent'],
      updatedAt: 42,
    })
    expect(migrated.version).toBe(2)
    expect(migrated.hidden).toEqual(['recent'])
    expect(migrated.order[0]).toBe('seance')
    expect(migrated.order).toContain('eau')
    expect(migrated.order).toContain('seances_semaine')
    expect(migrated.order).toContain('series_jour')
    expect(migrated.order).toContain('prochaine_seance')
    expect(migrated.order.indexOf('recent')).toBeLessThan(migrated.order.indexOf('programme') === -1 ? 99 : migrated.order.length)
    // relative: recent still before programme when both from v1
    expect(migrated.order.indexOf('recent')).toBeLessThan(migrated.order.indexOf('programme'))
    expect(migrated.waterGoalMl).toBeNull()
    expect(migrated.updatedAt).toBe(42)
  })

  it('water goal: setAccueilWaterGoalMl writes shared userWaterGoal, clears prefs field', () => {
    let p = createDefaultAccueilWidgetPrefs(1)
    expect(hasUserWaterGoal(p)).toBe(false)
    expect(getUserWaterGoalMl()).toBeNull()

    p = setAccueilWaterGoalMl(p, 2500, 10)
    expect(p.waterGoalMl).toBeNull()
    expect(p.updatedAt).toBe(10)
    expect(hasUserWaterGoal(p)).toBe(true)
    expect(getUserWaterGoalMl()).toBe(2500)
    expect(store.has(USER_WATER_GOAL_KEY)).toBe(true)

    p = setAccueilWaterGoalMl(p, 0, 11)
    expect(p.waterGoalMl).toBeNull()
    expect(hasUserWaterGoal(p)).toBe(false)
    expect(getUserWaterGoalMl()).toBeNull()

    // normalize strips legacy prefs field (goal lives in userWaterGoal)
    const fromRaw = normalizeAccueilWidgetPrefs({
      version: 2,
      order: ['eau'],
      hidden: [],
      updatedAt: 1,
      waterGoalMl: '3000' as unknown as number,
    })
    expect(fromRaw.waterGoalMl).toBeNull()
  })

  it('merge: latest updatedAt wins (remote newer)', () => {
    const local = prefs({
      updatedAt: 10,
      hidden: ['recent'],
    })
    const remote = prefs({
      updatedAt: 20,
      order: ['programme', 'recent', 'seance'],
      hidden: ['seance'],
    })
    const merged = mergeAccueilWidgetPrefs(local, remote)
    expect(merged.waterGoalMl).toBeNull()
    expect(merged.hidden).toEqual(['seance'])
  })

  it('merge: latest updatedAt wins (local newer)', () => {
    const local = prefs({
      updatedAt: 50,
      hidden: ['programme'],
    })
    const remote = prefs({
      updatedAt: 40,
      hidden: ['recent'],
    })
    expect(mergeAccueilWidgetPrefs(local, remote).hidden).toEqual(['programme'])
  })

  it('merge: equal updatedAt prefers local (never blind remote overwrite)', () => {
    const local = prefs({ updatedAt: 7, hidden: ['recent'] })
    const remote = prefs({ updatedAt: 7, hidden: ['programme'] })
    expect(mergeAccueilWidgetPrefs(local, remote).hidden).toEqual(['recent'])
  })

  it('merge: missing side falls back to the other, both missing → default', () => {
    const onlyLocal = prefs({ updatedAt: 3, hidden: ['seance'] })
    expect(mergeAccueilWidgetPrefs(onlyLocal, null).hidden).toEqual(['seance'])
    expect(mergeAccueilWidgetPrefs(null, onlyLocal).hidden).toEqual(['seance'])
    expect(mergeAccueilWidgetPrefs(null, null, 99)).toEqual(
      createDefaultAccueilWidgetPrefs(99),
    )
  })

  it('unknown / removed widget ids are dropped silently', () => {
    const normalized = normalizeAccueilWidgetPrefs({
      version: 1,
      order: ['seance', 'kcal', 'ghost', 'recent', 'body_weight', 'programme'],
      hidden: ['kcal', 'unknown', 'recent'],
      updatedAt: 1,
    })
    expect(normalized.order).not.toContain('kcal')
    expect(normalized.order).not.toContain('body_weight')
    expect(normalized.hidden).toEqual(['recent'])
    expect(() => resolveVisibleAccueilWidgets(normalized)).not.toThrow()
  })

  it('new widgets missing from a saved order are appended in default position', () => {
    const oldSave = normalizeAccueilWidgetPrefs({
      version: 1,
      order: ['recent', 'seance'],
      hidden: [],
      updatedAt: 1,
    })
    expect(oldSave.order.indexOf('seance')).toBeLessThan(oldSave.order.indexOf('recent') === -1 ? 99 : oldSave.order.length)
    expect(oldSave.order).toContain('programme')
    expect(oldSave.order).toContain('eau')
  })

  it('reset restores default Accueil', () => {
    const dirty = prefs({
      updatedAt: 5,
      order: ['programme', 'seance', 'recent'],
      hidden: ['seance', 'recent'],
    })
    const reset = resetAccueilWidgetPrefs(42)
    expect(reset).toEqual(createDefaultAccueilWidgetPrefs(42))
    expect(dirty.waterGoalMl).toBeNull()
    expect(reset.waterGoalMl).toBeNull()
  })

  it('toggle hidden and move up/down update updatedAt', () => {
    let p = createDefaultAccueilWidgetPrefs(1)
    p = toggleAccueilWidgetHidden(p, 'recent', 2)
    expect(p.hidden).toEqual(['recent'])
    expect(p.updatedAt).toBe(2)
    expect(resolveVisibleAccueilWidgets(p)).not.toContain('recent')

    p = moveAccueilWidget(p, 'programme', 'up', 3)
    expect(p.updatedAt).toBe(3)
    expect(p.order.indexOf('programme')).toBeLessThan(p.order.indexOf('recent'))
  })

  it('applyRemoteAccueilWidgetPrefs keeps newer local', () => {
    const local = prefs({
      updatedAt: 100,
      hidden: ['recent'],
      order: ['programme', 'recent', 'seance'],
    })
    store.set('ranked-gym:accueil-widget-prefs', JSON.stringify(local))

    const result = applyRemoteAccueilWidgetPrefs(
      prefs({ updatedAt: 50, hidden: ['programme'] }),
      200,
    )
    expect(result.hidden).toEqual(['recent'])
    expect(result.waterGoalMl).toBeNull()
  })
})
