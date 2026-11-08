/** @vitest-environment jsdom */
/**
 * M7 complément (EFSA 2010) — mineurs / âge inconnu :
 * 1) « repère » jamais « objectif »
 * 2) pas de message dépassement / célébration
 * 3) message permanent aliments/boissons
 * Adulte : comportement inchangé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import {
  LABEL_REPERE_JOUR,
  MSG_HIGH_INFO,
  MSG_MINOR_PERMANENT,
  MSG_NEUTRAL_OK,
  MSG_PERMANENT,
  MSG_REMINDER_PAUSE_GOAL,
  MSG_REMINDER_PAUSE_NEUTRAL,
  MSG_REPERE_LOCKED,
} from '../../shared/hydration'

const profileAge = { current: 30 as number | null }

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-test' } }),
}))

vi.mock('../../services/nutritionStorage', () => ({
  getCalorieProfile: () => ({ age: profileAge.current }),
}))

function todayFixture(overrides: Record<string, unknown> = {}) {
  return {
    dayKey: '2026-11-08',
    mode: 'classic_2l',
    goalMl: 1500,
    drunkMl: 3200,
    remainingMl: 0,
    showHighInfo: true,
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
    confirmedMl: 3200,
    ...overrides,
  }
}

vi.mock('../../services/hydration/hydrationService', () => ({
  HYDRATION_CHANGED_EVENT: 'ranked-gym:hydration-changed',
  onHydrationAccountChanged: vi.fn(),
  fetchHydrationToday: vi.fn(async () => todayFixture()),
  addHydrationEntry: vi.fn(async () => todayFixture()),
  undoLastHydrationEntry: vi.fn(),
  flushHydrationPendingQueue: vi.fn(async () => 0),
}))

vi.mock('../../services/hydration/bottleShapeStorage', () => ({
  loadBottleShapeUrl: vi.fn(async () => null),
}))

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => true,
}))

async function renderCard(
  root: Root,
  host: HTMLDivElement,
  props: { onOpenSettings?: () => void } = {},
) {
  const { WaterCard } = await import('./WaterCard')
  await act(async () => {
    root.render(<WaterCard {...props} />)
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return host
}

function assertNoObjectifWording(text: string) {
  expect(text.toLowerCase()).not.toContain('objectif')
  expect(text.toLowerCase()).not.toContain('à atteindre')
  expect(text).not.toContain(MSG_NEUTRAL_OK)
  expect(text).not.toContain(MSG_HIGH_INFO)
}

describe('M7 complément — WaterCard mineur / âge inconnu / adulte', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    profileAge.current = 30
    vi.resetModules()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('mineur (17) : repère + permanent + aucun objectif/dépassement', async () => {
    profileAge.current = 17
    await renderCard(root, host)
    const text = host.textContent ?? ''
    expect(host.querySelector('[data-hydration-minor="1"]')).toBeTruthy()
    expect(host.querySelector('[data-hydration-repere]')).toBeTruthy()
    expect(text).toContain(LABEL_REPERE_JOUR)
    expect(text).toContain(MSG_MINOR_PERMANENT)
    expect(text).toContain(MSG_REPERE_LOCKED)
    expect(host.querySelector('[data-hydration-minor-permanent]')?.textContent).toBe(
      MSG_MINOR_PERMANENT,
    )
    expect(host.querySelector('[data-hydration-high-info]')).toBeNull()
    expect(text).not.toContain(MSG_PERMANENT)
    assertNoObjectifWording(text)
  })

  it('âge inconnu (null) : mêmes règles que mineur', async () => {
    profileAge.current = null
    await renderCard(root, host)
    const text = host.textContent ?? ''
    expect(host.querySelector('[data-hydration-minor="1"]')).toBeTruthy()
    expect(text).toContain(LABEL_REPERE_JOUR)
    expect(text).toContain(MSG_MINOR_PERMANENT)
    expect(host.querySelector('[data-hydration-high-info]')).toBeNull()
    assertNoObjectifWording(text)
  })

  it('adulte : MSG_PERMANENT + high-info ≥3 L + pas de copie mineur', async () => {
    profileAge.current = 30
    await renderCard(root, host, { onOpenSettings: () => {} })
    const text = host.textContent ?? ''
    expect(host.querySelector('[data-hydration-minor="0"]')).toBeTruthy()
    expect(host.querySelector('[data-hydration-remaining]')).toBeTruthy()
    expect(text).toContain(MSG_PERMANENT)
    expect(host.querySelector('[data-hydration-high-info]')?.textContent).toBe(MSG_HIGH_INFO)
    expect(text).not.toContain(MSG_MINOR_PERMANENT)
    expect(text).not.toContain(LABEL_REPERE_JOUR)
    expect(host.querySelector('[data-hydration-settings]')).toBeTruthy()
  })
})

describe('M7 complément — WaterReminders pause copy', () => {
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

  it('mineur : pause neutre sans « objectif » / réussite', async () => {
    const { WaterReminders } = await import('./WaterReminders')
    await act(async () => {
      root.render(
        <WaterReminders
          enabled
          times={['10:00', '14:00', '18:00']}
          goalReachedToday
          useRepereCopy
          onChange={() => {}}
        />,
      )
    })
    const text = host.textContent ?? ''
    expect(host.querySelector('[data-hydration-reminder-pause="repere"]')?.textContent).toBe(
      MSG_REMINDER_PAUSE_NEUTRAL,
    )
    expect(text).not.toContain('Objectif')
    expect(text).not.toContain('atteint')
    expect(text).not.toContain(MSG_REMINDER_PAUSE_GOAL)
  })

  it('adulte : libellé pause objectif inchangé', async () => {
    const { WaterReminders } = await import('./WaterReminders')
    await act(async () => {
      root.render(
        <WaterReminders
          enabled
          times={['10:00', '14:00', '18:00']}
          goalReachedToday
          onChange={() => {}}
        />,
      )
    })
    expect(host.querySelector('[data-hydration-reminder-pause="goal"]')?.textContent).toBe(
      MSG_REMINDER_PAUSE_GOAL,
    )
  })
})
