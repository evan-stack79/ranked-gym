import { describe, expect, it } from 'vitest'
import {
  ACCUEIL_LONG_PRESS_MOVE_PX,
  ACCUEIL_LONG_PRESS_MS,
  hitTestWidgetId,
  movementExceedsThreshold,
  shouldEnterEditFromLongPress,
} from './accueilEditGestures'
import {
  createDefaultAccueilWidgetPrefs,
  hideAccueilWidget,
  reorderVisibleAccueilWidget,
  resolveHiddenAccueilWidgets,
  resolveVisibleAccueilWidgets,
  showAccueilWidget,
} from './accueilWidgetPrefs'

describe('accueilEditGestures — long-press vs scroll', () => {
  it('enters edit only after 500ms without moving >10px', () => {
    expect(
      shouldEnterEditFromLongPress({
        heldMs: ACCUEIL_LONG_PRESS_MS,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
      }),
    ).toBe(true)

    expect(
      shouldEnterEditFromLongPress({
        heldMs: ACCUEIL_LONG_PRESS_MS - 1,
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
      }),
    ).toBe(false)

    expect(
      shouldEnterEditFromLongPress({
        heldMs: ACCUEIL_LONG_PRESS_MS,
        startX: 0,
        startY: 0,
        endX: ACCUEIL_LONG_PRESS_MOVE_PX + 1,
        endY: 0,
      }),
    ).toBe(false)

    expect(movementExceedsThreshold(10, 10, 10 + 9, 10)).toBe(false)
    expect(movementExceedsThreshold(10, 10, 10 + 11, 10)).toBe(true)
  })

  it('hit-tests the widget under a point', () => {
    const rects = [
      { id: 'eau', left: 0, top: 0, right: 100, bottom: 100 },
      { id: 'series_jour', left: 110, top: 0, right: 210, bottom: 100 },
    ]
    expect(hitTestWidgetId(50, 50, rects)).toBe('eau')
    expect(hitTestWidgetId(150, 40, rects)).toBe('series_jour')
    expect(hitTestWidgetId(300, 40, rects)).toBeNull()
  })
})

describe('accueil edit — reorder / remove / re-add', () => {
  it('reorders visible widgets and preserves hidden slots', () => {
    let p = createDefaultAccueilWidgetPrefs(1)
    p = hideAccueilWidget(p, 'recent', 2)
    const before = resolveVisibleAccueilWidgets(p)
    expect(before[0]).toBe('seance')
    // Drag programme onto seances_semaine
    p = reorderVisibleAccueilWidget(p, 'programme', 'seances_semaine', 3)
    const visible = resolveVisibleAccueilWidgets(p)
    expect(visible.indexOf('programme')).toBe(visible.indexOf('seances_semaine') - 1)
    expect(visible.indexOf('programme')).toBeLessThan(visible.indexOf('eau'))
    // recent stays hidden
    expect(resolveHiddenAccueilWidgets(p)).toContain('recent')
    expect(p.updatedAt).toBe(3)
  })

  it('hides with trash and re-adds from + Ajouter list', () => {
    let p = createDefaultAccueilWidgetPrefs(1)
    expect(resolveVisibleAccueilWidgets(p)).toContain('eau')
    p = hideAccueilWidget(p, 'eau', 2)
    expect(resolveVisibleAccueilWidgets(p)).not.toContain('eau')
    expect(resolveHiddenAccueilWidgets(p)).toEqual(expect.arrayContaining(['eau']))
    p = showAccueilWidget(p, 'eau', 3)
    expect(resolveVisibleAccueilWidgets(p)).toContain('eau')
    expect(resolveHiddenAccueilWidgets(p)).not.toContain('eau')
    expect(p.updatedAt).toBe(3)
  })
})
