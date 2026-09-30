/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthStateProvider } from '../../context/AuthContext'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from '../../test/authFixtureValue'
import { MealPhotoAnalyzer } from './MealPhotoAnalyzer'
import { __resetBodyScrollLockForTests } from '../../utils/bodyScrollLock'

const analyzeMealPhoto = vi.fn()
const getAiMealUsageToday = vi.fn()

vi.mock('../../services/mealPhotoAi', async () => {
  const actual = await vi.importActual<typeof import('../../services/mealPhotoAi')>(
    '../../services/mealPhotoAi',
  )
  return {
    ...actual,
    analyzeMealPhoto: (...args: unknown[]) => analyzeMealPhoto(...args),
    getAiMealUsageToday: (...args: unknown[]) => getAiMealUsageToday(...args),
  }
})

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  analyzeMealPhoto.mockReset()
  getAiMealUsageToday.mockReset()
  getAiMealUsageToday.mockResolvedValue({
    scanCount: 0,
    dailyLimit: 5,
    scansRemaining: 5,
  })
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => 'blob:meal-preview',
    revokeObjectURL: () => undefined,
  })
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
  vi.unstubAllGlobals()
})

function renderAnalyzer() {
  const authValue = buildAuthContextValue({
    user: FIXTURE_AUTH_USER,
    isAuthenticated: true,
  })
  root.render(
    <AuthStateProvider value={authValue}>
      <MealPhotoAnalyzer variant="headless" onAnalyzed={() => undefined} />
    </AuthStateProvider>,
  )
}

describe('MealPhotoAnalyzer AI overlay', () => {
  it('shows the analysis overlay while the photo scan is in flight', async () => {
    let resolveScan: (value: unknown) => void = () => undefined
    analyzeMealPhoto.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve
        }),
    )

    await act(async () => {
      renderAnalyzer()
    })

    const input = host.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['fake'], 'meal.jpg', { type: 'image/jpeg' })
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const dialog = document.querySelector('[role="dialog"][aria-busy="true"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.textContent).toContain('Analyse du repas')
    expect(dialog?.textContent).not.toMatch(/\d+\s*min/)

    await act(async () => {
      resolveScan({
        calories: 510,
        proteines: 32,
        glucides: 40,
        lipides: 18,
        scanCount: 1,
        dailyLimit: 5,
        scansRemaining: 4,
      })
    })
    expect(document.querySelector('[role="dialog"][aria-busy="true"]')).toBeNull()
  })
})
