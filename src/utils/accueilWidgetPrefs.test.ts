import { describe, expect, it, vi } from 'vitest'
import {
  applyRemoteAccueilWidgetPrefs,
  createDefaultAccueilWidgetPrefs,
  mergeAccueilWidgetPrefs,
  moveAccueilWidget,
  normalizeAccueilWidgetPrefs,
  resetAccueilWidgetPrefs,
  resolveVisibleAccueilWidgets,
  toggleAccueilWidgetHidden,
  type AccueilWidgetPrefs,
} from './accueilWidgetPrefs'

function prefs(
  partial: Partial<AccueilWidgetPrefs> & Pick<AccueilWidgetPrefs, 'updatedAt'>,
): AccueilWidgetPrefs {
  return {
    version: 1,
    order: ['seance', 'recent', 'programme'],
    hidden: [],
    ...partial,
  }
}

describe('accueilWidgetPrefs', () => {
  it('default order is Séance → Récent → Programme, nothing hidden', () => {
    const d = createDefaultAccueilWidgetPrefs(1000)
    expect(d.order).toEqual(['seance', 'recent', 'programme'])
    expect(d.hidden).toEqual([])
    expect(d.updatedAt).toBe(1000)
    expect(resolveVisibleAccueilWidgets(d)).toEqual(['seance', 'recent', 'programme'])
  })

  it('merge: latest updatedAt wins (remote newer)', () => {
    const local = prefs({
      updatedAt: 10,
      order: ['seance', 'recent', 'programme'],
      hidden: ['recent'],
    })
    const remote = prefs({
      updatedAt: 20,
      order: ['programme', 'recent', 'seance'],
      hidden: ['seance'],
    })
    expect(mergeAccueilWidgetPrefs(local, remote)).toEqual(
      normalizeAccueilWidgetPrefs(remote),
    )
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
    expect(mergeAccueilWidgetPrefs(local, remote)).toEqual(
      normalizeAccueilWidgetPrefs(local),
    )
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
    expect(normalized.order).toEqual(['seance', 'recent', 'programme'])
    expect(normalized.hidden).toEqual(['recent'])
    expect(() => resolveVisibleAccueilWidgets(normalized)).not.toThrow()
  })

  it('new widgets missing from a saved order are appended in default position', () => {
    const oldSave = normalizeAccueilWidgetPrefs({
      version: 1,
      // Simulate an older build that only knew seance + recent (user had swapped them)
      order: ['recent', 'seance'],
      hidden: [],
      updatedAt: 1,
    })
    // Keep the saved relative order; append programme (new) in its default slot
    expect(oldSave.order).toEqual(['recent', 'seance', 'programme'])
    expect(oldSave.order.indexOf('programme')).toBeGreaterThan(oldSave.order.indexOf('recent'))
  })

  it('new widget inserts before later default neighbors when mid-order', () => {
    // Only programme was saved — seance and recent should land in default slots
    const normalized = normalizeAccueilWidgetPrefs({
      version: 1,
      order: ['programme'],
      hidden: [],
      updatedAt: 1,
    })
    expect(normalized.order).toEqual(['seance', 'recent', 'programme'])
  })

  it('reset restores default Accueil', () => {
    const dirty = prefs({
      updatedAt: 5,
      order: ['programme', 'seance', 'recent'],
      hidden: ['seance', 'recent'],
    })
    const reset = resetAccueilWidgetPrefs(42)
    expect(reset).toEqual(createDefaultAccueilWidgetPrefs(42))
    expect(resolveVisibleAccueilWidgets(reset)).toEqual(['seance', 'recent', 'programme'])
    expect(dirty.hidden).not.toEqual(reset.hidden)
  })

  it('toggle hidden and move up/down update updatedAt', () => {
    let p = createDefaultAccueilWidgetPrefs(1)
    p = toggleAccueilWidgetHidden(p, 'recent', 2)
    expect(p.hidden).toEqual(['recent'])
    expect(p.updatedAt).toBe(2)
    expect(resolveVisibleAccueilWidgets(p)).toEqual(['seance', 'programme'])

    p = moveAccueilWidget(p, 'programme', 'up', 3)
    expect(p.order).toEqual(['seance', 'programme', 'recent'])
    expect(p.updatedAt).toBe(3)

    p = moveAccueilWidget(p, 'programme', 'up', 4)
    expect(p.order).toEqual(['programme', 'seance', 'recent'])

    p = moveAccueilWidget(p, 'programme', 'up', 5)
    // already first — no order change, still bumps updatedAt
    expect(p.order).toEqual(['programme', 'seance', 'recent'])
    expect(p.updatedAt).toBe(5)
  })

  it('applyRemoteAccueilWidgetPrefs keeps newer local', () => {
    const storage: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = v
      },
      removeItem: (k: string) => {
        delete storage[k]
      },
    })

    const local = prefs({ updatedAt: 100, hidden: ['recent'], order: ['programme', 'recent', 'seance'] })
    storage['ranked-gym:accueil-widget-prefs'] = JSON.stringify(local)

    const result = applyRemoteAccueilWidgetPrefs(
      prefs({ updatedAt: 50, hidden: ['programme'] }),
      200,
    )
    expect(result.hidden).toEqual(['recent'])
    expect(result.order).toEqual(['programme', 'recent', 'seance'])

    vi.unstubAllGlobals()
  })
})
