import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { BetaFeedbackScreen } from './BetaFeedbackScreen'
import {
  BETA_FEEDBACK_BACK,
  BETA_FEEDBACK_CALL_15,
  BETA_FEEDBACK_CALL_3114,
  BETA_FEEDBACK_COMPLETE_PROFILE,
  BETA_FEEDBACK_CONFIRM,
  BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE,
  BETA_FEEDBACK_CONFIRM_URGENT_TCA,
  BETA_FEEDBACK_CONSENT_MORE_BODY,
  BETA_FEEDBACK_EMPTY,
  BETA_FEEDBACK_NEED_TO_TALK,
  BETA_FEEDBACK_NO_REALTIME,
  BETA_FEEDBACK_OPEN_PROFILE,
  BETA_FEEDBACK_SCREEN_TITLE,
  BETA_FEEDBACK_SETTINGS_LABEL,
  BETA_FEEDBACK_SUBMIT,
  BETA_FEEDBACK_TEL_15,
  BETA_FEEDBACK_TEL_3114,
  BETA_FEEDBACK_TEXTE_HINT,
  BETA_FEEDBACK_TOO_LONG,
  BETA_FEEDBACK_TYPE_GROUP_LABEL,
  BETA_FEEDBACK_VERSION_LABEL,
} from '../../content/betaFeedbackCopy'
import { saveCalorieProfile, getCalorieProfile } from '../../services/nutritionStorage'
import { submitAvisBeta } from '../../services/convexAvisBetaService'
import { enqueueAvisOffline } from '../../services/avisBetaOfflineQueue'

vi.mock('../../services/convexAvisBetaService', () => ({
  createAvisAntiDoublonKey: () => 'test-key',
  submitAvisBeta: vi.fn(async () => ({
    ok: true,
    avisId: 'avis_1',
    statut: 'nouveau',
    signalUrgent: false,
    distressLevel: 0,
    motsMasques: false,
    duplicate: false,
    needsReformulation: false,
  })),
}))

vi.mock('../../services/avisBetaOfflineQueue', () => ({
  enqueueAvisOffline: vi.fn(),
  wireAvisQueueLifecycleOnce: vi.fn(),
}))

async function setTexte(host: HTMLElement, value: string) {
  const textarea = host.querySelector(
    '[data-testid="beta-feedback-texte"]',
  ) as HTMLTextAreaElement
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(textarea, value)
    textarea.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function fillAndSubmit(
  host: HTMLElement,
  texte = 'Le chrono reste bloqué à zéro quand je reviens.',
) {
  await act(async () => {
    host.querySelector('[data-testid="beta-feedback-type-bug"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
  })

  await setTexte(host, texte)

  const consent = host.querySelector(
    '[data-testid="beta-feedback-consent"]',
  ) as HTMLInputElement
  await act(async () => {
    consent.click()
  })

  await act(async () => {
    host.querySelector('[data-testid="beta-feedback-submit"]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
  })
}

describe('BetaFeedbackScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
    vi.mocked(submitAvisBeta).mockReset()
    vi.mocked(enqueueAvisOffline).mockReset()
    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: true,
      avisId: 'avis_1',
      statut: 'nouveau',
      signalUrgent: false,
      distressLevel: 0,
      motsMasques: false,
      duplicate: false,
      needsReformulation: false,
    })
    const current = getCalorieProfile()
    saveCalorieProfile({ ...current, age: 28 })
  })

  it('affiche le formulaire adulte avec titres et case non cochée', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })

    expect(host.textContent).toContain(BETA_FEEDBACK_SCREEN_TITLE)
    expect(host.textContent).toContain(BETA_FEEDBACK_TEXTE_HINT)
    expect(host.textContent).not.toContain('Studio Manager')
    expect(BETA_FEEDBACK_CONSENT_MORE_BODY).not.toContain('Studio Manager')
    expect(host.textContent).not.toContain('RPE')
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
          onOpenProfile={() => undefined}
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
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    expect(host.textContent).toContain('personnes majeures')
    expect(host.querySelector('[data-testid="beta-feedback-submit"]')).toBeNull()
    expect(host.querySelector('[data-testid="beta-feedback-complete-profile"]')).toBeNull()
    root.unmount()
    host.remove()
  })

  it('âge manquant : message profil, bouton profil, lien Besoin d’en parler ?', async () => {
    const current = getCalorieProfile()
    saveCalorieProfile({ ...current, age: 0 })
    const onOpenProfile = vi.fn()
    const onOpenNeedToTalk = vi.fn()
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen
          onBack={() => undefined}
          onOpenNeedToTalk={onOpenNeedToTalk}
          onOpenProfile={onOpenProfile}
        />,
      )
    })

    expect(host.querySelector('[data-age-gate="missing"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="beta-feedback-complete-profile"]')?.textContent).toBe(
      BETA_FEEDBACK_COMPLETE_PROFILE,
    )
    expect(host.querySelector('[data-testid="beta-feedback-submit"]')).toBeNull()

    const profileBtn = host.querySelector(
      '[data-testid="beta-feedback-open-profile"]',
    ) as HTMLButtonElement
    expect(profileBtn?.textContent).toBe(BETA_FEEDBACK_OPEN_PROFILE)
    await act(async () => {
      profileBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onOpenProfile).toHaveBeenCalledTimes(1)

    const help = host.querySelector(
      '[data-testid="beta-feedback-need-to-talk"]',
    ) as HTMLButtonElement
    expect(help?.textContent).toBe(BETA_FEEDBACK_NEED_TO_TALK)
    await act(async () => {
      help.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onOpenNeedToTalk).toHaveBeenCalledTimes(1)

    root.unmount()
    host.remove()
  })

  it('garde le bouton d’envoi grisé tant que le formulaire est incomplet', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
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

  it('affiche le niveau 1 (TCA) avec lien Besoin d’en parler ?', async () => {
    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: true,
      avisId: 'avis_tca',
      statut: 'urgent',
      signalUrgent: true,
      distressLevel: 1,
      motsMasques: false,
      duplicate: false,
      needsReformulation: false,
    })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await fillAndSubmit(host)

    expect(host.getAttribute('data-distress-level') || host.querySelector('[data-distress-level="1"]')).toBeTruthy()
    expect(host.textContent).toContain(BETA_FEEDBACK_CONFIRM_URGENT_TCA)
    expect(host.querySelector('[data-testid="beta-feedback-need-to-talk"]')?.textContent).toBe(
      BETA_FEEDBACK_NEED_TO_TALK,
    )
    expect(host.querySelector('[data-testid="beta-feedback-call-3114"]')).toBeNull()

    root.unmount()
    host.remove()
  })

  it('affiche le niveau 2 avec tel:3114, tel:15 et texte 112', async () => {
    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: true,
      avisId: 'avis_s',
      statut: 'urgent',
      signalUrgent: true,
      distressLevel: 2,
      motsMasques: false,
      duplicate: false,
      needsReformulation: false,
    })

    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await fillAndSubmit(host)

    expect(host.querySelector('[data-distress-level="2"]')).toBeTruthy()
    expect(host.textContent).toContain(BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE)
    expect(host.textContent).toContain(BETA_FEEDBACK_NO_REALTIME)
    expect(host.textContent).toContain(BETA_FEEDBACK_CALL_3114)
    expect(host.textContent).toContain(BETA_FEEDBACK_CALL_15)
    expect(host.querySelector(`[href="${BETA_FEEDBACK_TEL_3114}"]`)).toBeTruthy()
    expect(host.querySelector(`[href="${BETA_FEEDBACK_TEL_15}"]`)).toBeTruthy()
    expect(host.textContent).toMatch(/112/)
    expect(host.textContent).not.toMatch(/0\s*810/)
    expect(host.querySelector('[data-testid="beta-feedback-need-to-talk"]')).toBeTruthy()

    root.unmount()
    host.remove()
  })

  it('AV-03 — hors ligne, affiche l’aide détresse localement', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await fillAndSubmit(host, 'j’ai envie de mourir vraiment beaucoup')

    expect(enqueueAvisOffline).toHaveBeenCalled()
    expect(submitAvisBeta).not.toHaveBeenCalled()
    expect(host.querySelector('[data-distress-level="2"]')).toBeTruthy()
    expect(host.textContent).toContain(BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE)
    expect(host.querySelector(`[href="${BETA_FEEDBACK_TEL_3114}"]`)).toBeTruthy()

    root.unmount()
    host.remove()
  })

  it('AV-04 — limite serveur : aide détresse locale quand même', async () => {
    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: false,
      error: 'AVIS_BETA_DAILY_LIMIT',
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await fillAndSubmit(host, 'j’ai envie de mourir vraiment beaucoup')

    expect(host.querySelector('[data-distress-level="2"]')).toBeTruthy()
    expect(host.textContent).toContain(BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE)

    root.unmount()
    host.remove()
  })

  it('critère 5 / AV-09 / AV-21 — message vide après interaction seulement', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    expect(host.querySelector('[data-testid="beta-feedback-empty-hint"]')).toBeNull()
    await setTexte(host, 'court')
    expect(host.querySelector('[data-testid="beta-feedback-empty-hint"]')?.textContent).toBe(
      BETA_FEEDBACK_EMPTY,
    )
    root.unmount()
    host.remove()
  })

  it('AV-18 — erreur réseau + détresse → file hors ligne + aide', async () => {
    vi.mocked(submitAvisBeta).mockRejectedValue(new Error('network down'))
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await fillAndSubmit(host, 'j’ai envie de mourir vraiment beaucoup')

    expect(enqueueAvisOffline).toHaveBeenCalled()
    expect(host.querySelector('[data-distress-level="2"]')).toBeTruthy()
    expect(host.textContent).toContain(BETA_FEEDBACK_CONFIRM_URGENT_SUICIDE)

    root.unmount()
    host.remove()
  })

  it('AV-19 — AGE_REQUIRED adulte local → Complète ton profil', async () => {
    vi.mocked(submitAvisBeta).mockResolvedValue({
      ok: false,
      error: 'AVIS_BETA_AGE_REQUIRED',
    })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await fillAndSubmit(host)

    expect(host.querySelector('[data-age-gate="missing"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="beta-feedback-complete-profile"]')?.textContent).toBe(
      BETA_FEEDBACK_COMPLETE_PROFILE,
    )
    expect(host.textContent).not.toContain('personnes majeures')

    root.unmount()
    host.remove()
  })

  it('AV-17 — hors ligne + insulte → reformuler / masquage (pas d’envoi forcé)', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await fillAndSubmit(host, 'Cette merde de chrono plante encore.')

    expect(enqueueAvisOffline).not.toHaveBeenCalled()
    expect(host.textContent).toContain('reformuler')
    expect(host.querySelector('[data-testid="beta-feedback-offline-insult"]')).toBeTruthy()

    root.unmount()
    host.remove()
  })

  it('critère 6 / AV-10 — message trop long si collage > 2000', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    await setTexte(host, 'x'.repeat(2001))
    expect(host.querySelector('[data-testid="beta-feedback-too-long-hint"]')?.textContent).toBe(
      BETA_FEEDBACK_TOO_LONG,
    )
    const textarea = host.querySelector(
      '[data-testid="beta-feedback-texte"]',
    ) as HTMLTextAreaElement
    expect(textarea.value.length).toBe(2000)
    root.unmount()
    host.remove()
  })

  it('AV-15 / AV-16 — une seule ligne Version + textes depuis copy', async () => {
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    await act(async () => {
      root.render(
        <BetaFeedbackScreen onBack={() => undefined} onOpenNeedToTalk={() => undefined} onOpenProfile={() => undefined} />,
      )
    })
    const meta = host.querySelector('[data-testid="beta-feedback-meta"]')?.textContent ?? ''
    const versionHits = meta.split(BETA_FEEDBACK_VERSION_LABEL).length - 1
    expect(versionHits).toBe(1)
    expect(host.textContent).toContain(BETA_FEEDBACK_BACK)
    expect(
      host.querySelector(`[aria-label="${BETA_FEEDBACK_TYPE_GROUP_LABEL}"]`),
    ).toBeTruthy()
    root.unmount()
    host.remove()
  })
})
