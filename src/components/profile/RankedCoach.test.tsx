/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'

const isConvexConfigured = vi.fn()
const askRankedIntelligence = vi.fn()

vi.mock('../../lib/convex', () => ({
  isConvexConfigured: () => isConvexConfigured(),
}))

vi.mock('../../services/rankedIntelligenceService', () => ({
  RANKED_INTELLIGENCE_DEFAULT_QUESTION: 'q',
  askRankedIntelligence: (...args: unknown[]) => askRankedIntelligence(...args),
}))

import { RankedCoach } from './RankedCoach'

describe('RankedCoach', () => {
  let host: HTMLDivElement
  let root: Root

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
    vi.clearAllMocks()
  })

  it('ne rend rien si Convex n’est pas configuré', () => {
    isConvexConfigured.mockReturnValue(false)
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(<RankedCoach />)
    })
    expect(host.querySelector('[data-testid="ranked-coach"]')).toBeNull()
  })

  it('affiche le CTA et appelle le service avec sessionToken (via service)', async () => {
    isConvexConfigured.mockReturnValue(true)
    askRankedIntelligence.mockResolvedValue({
      ok: true,
      source: 'ai',
      message: 'Bosse le squat.',
      aiCallsToday: 1,
      dailyLimit: 3,
      remaining: 2,
      leanMassKg: 68,
      ffmi: 21,
    })

    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => {
      root.render(<RankedCoach />)
    })

    const button = host.querySelector('button')
    expect(button?.textContent).toMatch(/Lancer le bilan IA/i)

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(askRankedIntelligence).toHaveBeenCalledTimes(1)
    expect(host.textContent).toContain('Bosse le squat.')
    expect(host.textContent).toContain('coach IA')
  })
})
