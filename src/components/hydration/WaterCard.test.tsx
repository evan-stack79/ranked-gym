/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { MSG_PERMANENT } from '../../shared/hydration'

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test' } }),
}))

vi.mock('../../services/nutritionStorage', () => ({
  getCalorieProfile: () => ({ age: 30 }),
}))

vi.mock('../../services/hydration/hydrationService', () => ({
  HYDRATION_CHANGED_EVENT: 'ranked-gym:hydration-changed',
  onHydrationAccountChanged: vi.fn(),
  fetchHydrationToday: vi.fn(async () => ({
    dayKey: '2026-11-08',
    mode: 'classic_2l',
    goalMl: 1500,
    drunkMl: 500,
    remainingMl: 1000,
    showHighInfo: false,
    myBottleVolumeMl: null,
    myBottleHasShape: false,
    proActive: false,
    effectiveVisualMode: 'classic_2l',
    remindersEnabled: false,
    reminderTimes: ['10:00', '14:00', '18:00'],
    canUndo: true,
    lastEntryId: 'e1',
    glassMl: 250,
    classicBottleMl: 2000,
    labelEauBueSeule: true,
    pendingMl: 0,
    confirmedMl: 500,
  })),
  addHydrationEntry: vi.fn(async () => ({
    dayKey: '2026-11-08',
    mode: 'classic_2l',
    goalMl: 1500,
    drunkMl: 750,
    remainingMl: 750,
    showHighInfo: false,
    myBottleVolumeMl: null,
    myBottleHasShape: false,
    proActive: false,
    effectiveVisualMode: 'classic_2l',
    remindersEnabled: false,
    reminderTimes: ['10:00', '14:00', '18:00'],
    canUndo: true,
    lastEntryId: 'e2',
    glassMl: 250,
    classicBottleMl: 2000,
    labelEauBueSeule: true,
    pendingMl: 0,
    confirmedMl: 750,
  })),
  undoLastHydrationEntry: vi.fn(),
  flushHydrationPendingQueue: vi.fn(async () => 0),
}))

vi.mock('../../services/hydration/bottleShapeStorage', () => ({
  loadBottleShapeUrl: vi.fn(async () => null),
}))

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))

describe('WaterCard', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('CA-HY10 règle eau-seule dans la copie + pas de café/jus (sans libellé « Eau bue seule »)', async () => {
    const { WaterCard } = await import('./WaterCard')
    await act(async () => {
      root.render(<WaterCard />)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(host.textContent).not.toContain('Eau bue seule')
    expect(host.textContent).toContain(MSG_PERMANENT)
    expect(host.textContent?.toLowerCase()).not.toContain('café')
    expect(host.textContent?.toLowerCase()).not.toContain('jus')
    expect(host.querySelector('[data-hydration-add="glass"]')).toBeTruthy()
  })

  it('CA-HY2 boutons +1 / annuler présents', async () => {
    const { WaterCard } = await import('./WaterCard')
    await act(async () => {
      root.render(<WaterCard />)
    })
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(host.querySelector('[data-hydration-remaining]')).toBeTruthy()
    expect(host.querySelector('[data-hydration-undo]')).toBeTruthy()
  })
})
