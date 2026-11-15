import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HV_FEATURE_NAME } from '../../horaires-variables/constants'
import { emptyDayPlan } from '../../horaires-variables/engine'

const store = new Map<string, string>()

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

vi.mock('../cloudBackup', () => ({
  notifyLocalDataChanged: vi.fn(),
}))

vi.mock('../cloudSession', () => ({
  getActiveCloudUserId: vi.fn(() => null),
}))

describe('HV storage', () => {
  beforeEach(() => {
    store.clear()
  })

  it('defaults disabled + feature name', async () => {
    const { clearHvState, getHvState } = await import('./storage')
    clearHvState()
    const s = getHvState()
    expect(s.settings.enabled).toBe(false)
    expect(s.featureName).toBe(HV_FEATURE_NAME)
    expect(s.featureName).not.toContain('Horaires qui changent')
  })

  it('upserts day and records lastStartEditAt', async () => {
    const { clearHvState, getHvState, upsertHvDay } = await import('./storage')
    clearHvState()
    upsertHvDay({ ...emptyDayPlan('2026-11-16'), kind: 'tot', startHm: '08:00' })
    const s = getHvState()
    expect(s.days).toHaveLength(1)
    expect(s.settings.lastStartEditAt).toBeTruthy()
  })

  it('activates mode', async () => {
    const { clearHvState, getHvState, saveHvState } = await import('./storage')
    clearHvState()
    saveHvState({
      settings: { ...getHvState().settings, enabled: true, activatedAt: new Date().toISOString() },
    })
    expect(getHvState().settings.enabled).toBe(true)
  })
})
