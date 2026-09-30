/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MealPhotoAiLoadingState } from './MealPhotoAiLoadingState'
import { MealPhotoAiOverlay } from './MealPhotoAiOverlay'
import { MEAL_PHOTO_AI_SEQUENCES, MEAL_PHOTO_AI_TICK_MS } from './mealPhotoAiLoading'
import { __resetBodyScrollLockForTests } from '../../utils/bodyScrollLock'

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  )
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  __resetBodyScrollLockForTests()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('MealPhotoAiLoadingState', () => {
  it('shows the first meal-analysis status and never invents a duration', async () => {
    await act(async () => {
      root.render(<MealPhotoAiLoadingState />)
    })
    const status = host.querySelector('.meal-photo-ai-loading__status-text')
    expect(status?.textContent).toBe(`${MEAL_PHOTO_AI_SEQUENCES[0]?.status}…`)
    expect(host.textContent).not.toMatch(/\d+\s*min/)
    expect(host.textContent).not.toContain('NaN')
    expect(host.textContent).not.toContain('undefined')
    expect(host.textContent).toMatch(/calories/i)
  })

  it('advances the status after a tick', async () => {
    vi.useFakeTimers()
    await act(async () => {
      root.render(<MealPhotoAiLoadingState />)
    })
    await act(async () => {
      vi.advanceTimersByTime(MEAL_PHOTO_AI_TICK_MS)
    })
    const status = host.querySelector('.meal-photo-ai-loading__status-text')
    expect(status?.textContent).toBe(`${MEAL_PHOTO_AI_SEQUENCES[0]?.status}…`)
    expect(host.textContent).toContain('Détection du plat')
  })
})

describe('MealPhotoAiOverlay', () => {
  it('portals a labelled dialog while open and removes it when closed', async () => {
    await act(async () => {
      root.render(<MealPhotoAiOverlay open previewUrl="blob:meal" />)
    })
    const dialog = document.querySelector('[role="dialog"][aria-busy="true"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.querySelector('#meal-photo-ai-title')?.textContent).toBe('Analyse du repas')
    expect(dialog?.querySelector('img')?.getAttribute('src')).toBe('blob:meal')

    await act(async () => {
      root.render(<MealPhotoAiOverlay open={false} />)
    })
    expect(document.querySelector('[role="dialog"][aria-busy="true"]')).toBeNull()
  })
})
