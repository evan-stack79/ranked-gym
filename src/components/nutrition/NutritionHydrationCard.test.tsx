/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { NutritionHydrationCard } from './NutritionHydrationCard'
import {
  clearUserWaterGoal,
  getUserWaterGoalMl,
  setUserWaterGoalMl,
  USER_WATER_GOAL_KEY,
  WATER_GOAL_CHOICE_ADVICE,
} from '../../utils/userWaterGoal'

const store = new Map<string, string>()

describe('NutritionHydrationCard — objectif eau utilisateur', () => {
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
      matchMedia: () => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    clearUserWaterGoal()
    vi.unstubAllGlobals()
  })

  it('(a) sans objectif : total + bouton Choisir mon objectif + phrase exacte', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <NutritionHydrationCard consumedMl={500} goalMl={null} onAdd250={() => {}} />,
      )
    })
    expect(host.textContent).toContain('500 ml')
    expect(host.textContent).toContain('bus aujourd')
    expect(host.textContent).toContain('Choisir mon objectif')
    expect(host.textContent).toContain(WATER_GOAL_CHOICE_ADVICE)
    expect(host.querySelector('[role="progressbar"]')).toBeNull()
    expect(host.textContent).not.toContain('Objectif atteint')
    root.unmount()
    host.remove()
  })

  it('(b) objectif utilisateur : jauge / progression affichée', async () => {
    setUserWaterGoalMl(2000)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <NutritionHydrationCard consumedMl={500} goalMl={2000} onAdd250={() => {}} />,
      )
    })
    expect(host.querySelector('[role="progressbar"]')).not.toBeNull()
    expect(host.textContent).not.toContain('Choisir mon objectif')
    expect(host.textContent).toMatch(/0,50/)
    expect(host.textContent).toMatch(/2,00/)
    root.unmount()
    host.remove()
  })

  it('(c) source user conservée ; sans source rejetée', () => {
    setUserWaterGoalMl(2200)
    expect(JSON.parse(store.get(USER_WATER_GOAL_KEY)!).source).toBe('user')
    expect(getUserWaterGoalMl()).toBe(2200)

    store.set(
      USER_WATER_GOAL_KEY,
      JSON.stringify({ version: 1, goalMl: 3000, source: 'computed', updatedAt: Date.now() }),
    )
    expect(getUserWaterGoalMl()).toBeNull()
    expect(store.has(USER_WATER_GOAL_KEY)).toBe(false)
  })
})
