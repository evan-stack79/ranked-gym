import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { BetaFeedbackScreen } from './BetaFeedbackScreen'
import {
  BETA_FEEDBACK_CONFIRM,
  BETA_FEEDBACK_EMPTY,
  BETA_FEEDBACK_SCREEN_TITLE,
  BETA_FEEDBACK_SETTINGS_LABEL,
  BETA_FEEDBACK_SUBMIT,
} from '../../content/betaFeedbackCopy'
import { saveCalorieProfile, getCalorieProfile } from '../../services/nutritionStorage'

vi.mock('../../services/convexAvisBetaService', () => ({
  createAvisAntiDoublonKey: () => 'test-key',
  submitAvisBeta: vi.fn(async () => ({
    ok: true,
    avisId: 'avis_1',
    statut: 'nouveau',
    signalUrgent: false,
    motsMasques: false,
    duplicate: false,
    needsReformulation: false,
  })),
}))

vi.mock('../../services/avisBetaOfflineQueue', () => ({
  enqueueAvisOffline: vi.fn(),
  wireAvisQueueLifecycleOnce: vi.fn(),
}))

describe('BetaFeedbackScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    const current = getCalorieProfile()
    saveCalorieProfile({ ...current, age: 28 })
  })

  it('affiche le formulaire adulte avec titres et case non cochée', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} />,
      )
    })

    expect(host.textContent).toContain(BETA_FEEDBACK_SCREEN_TITLE)
    expect(host.textContent).not.toContain('RPE')
    expect(host.textContent).not.toMatch(/\bRPE\b/i)
    const consent = host.querySelector(
      '[data-testid="beta-feedback-consent"]',
    ) as HTMLInputElement | null
    expect(consent?.checked).toBe(false)
    const submit = host.querySelector(
      '[data-testid="beta-feedback-submit"]',
    ) as HTMLButtonElement | null
    expect(submit?.disabled).toBe(true)
    expect(host.textContent).toContain(BETA_FEEDBACK_SUBMIT)

    root.unmount()
    host.remove()
  })

  it('préremplit la page Fin de séance', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen
          onBack={() => undefined}
          onOpenNeedToTalk={() => undefined}
          initialPage="Fin de séance"
        />,
      )
    })
    const select = host.querySelector(
      '[data-testid="beta-feedback-page"]',
    ) as HTMLSelectElement | null
    expect(select?.value).toBe('Fin de séance')
    root.unmount()
    host.remove()
  })

  it('bloque l’écran si âge mineur', async () => {
    const current = getCalorieProfile()
    saveCalorieProfile({ ...current, age: 16 })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} />,
      )
    })
    expect(host.textContent).toContain('personnes majeures')
    expect(host.querySelector('[data-testid="beta-feedback-submit"]')).toBeNull()
    root.unmount()
    host.remove()
  })

  it('garde le bouton d’envoi grisé tant que le formulaire est incomplet', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} />,
      )
    })

    await act(async () => {
      host.querySelector('[data-testid="beta-feedback-type-bug"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    const submit = host.querySelector(
      '[data-testid="beta-feedback-submit"]',
    ) as HTMLButtonElement | null
    expect(submit?.disabled).toBe(true)
    expect(BETA_FEEDBACK_EMPTY.length).toBeGreaterThan(5)
    expect(BETA_FEEDBACK_SETTINGS_LABEL).toBe('Donner mon avis')
    expect(BETA_FEEDBACK_CONFIRM).toContain('Merci')

    root.unmount()
    host.remove()
  })
})
