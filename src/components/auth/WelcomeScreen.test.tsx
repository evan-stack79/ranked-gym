/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WelcomeScreen } from './WelcomeScreen'
import {
  WELCOME_BETA,
  WELCOME_CTA,
  WELCOME_HERO_PNG,
  WELCOME_HERO_WEBP,
  WELCOME_SUBTITLE,
  WELCOME_TITLE,
} from './welcomeCopy'
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '../legal/legalRoutes'

async function renderWelcome(onConnect = vi.fn()) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<WelcomeScreen onConnect={onConnect} />)
  })
  return {
    host,
    onConnect,
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

describe('WelcomeScreen', () => {
  it('affiche le copy français exact sur la photo hero, sans second logo', async () => {
    const { host, cleanup } = await renderWelcome()
    expect(host.querySelector('[data-welcome-screen]')).toBeTruthy()
    expect(host.textContent).toContain('Ranked')
    expect(host.textContent).toContain('Gym')
    expect(host.textContent).toContain(WELCOME_TITLE)
    expect(host.textContent).toContain(WELCOME_SUBTITLE)
    expect(host.textContent).toContain(WELCOME_CTA)
    expect(host.textContent).toContain(WELCOME_BETA)
    expect(host.textContent).toContain('Conditions d’utilisation')
    expect(host.textContent).toContain('Politique de confidentialité')
    expect(host.textContent).not.toMatch(/haltère|dumbbell|barre|raquette|ballon/i)
    expect(host.textContent).not.toContain('Récupération des données')
    expect(host.textContent).not.toContain('Chargement')

    const imgs = [...host.querySelectorAll('img')]
    expect(imgs).toHaveLength(1)
    expect(host.querySelector('.welcome-screen__logo')).toBeNull()
    expect(host.querySelector('.welcome-screen__texture')).toBeNull()

    const hero = host.querySelector('[data-welcome-hero]') as HTMLImageElement
    expect(hero.className).toContain('welcome-screen__hero')
    expect(hero.src).toContain(WELCOME_HERO_PNG)
    expect(host.querySelector(`source[srcset="${WELCOME_HERO_WEBP}"]`)).toBeTruthy()

    await cleanup()
  })

  it('ouvre la connexion au CTA et expose les liens légaux réels', async () => {
    const { host, onConnect, cleanup } = await renderWelcome()
    const cta = [...host.querySelectorAll('button')].find((el) => el.textContent === WELCOME_CTA)
    expect(cta).toBeTruthy()
    expect((cta as HTMLButtonElement).className).not.toMatch(/gradient|glow/)
    await act(async () => {
      cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(onConnect).toHaveBeenCalledTimes(1)

    const terms = host.querySelector(`a[href="${LEGAL_TERMS_PATH}"]`)
    const privacy = host.querySelector(`a[href="${LEGAL_PRIVACY_PATH}"]`)
    expect(terms?.textContent).toBe('Conditions d’utilisation')
    expect(privacy?.textContent).toBe('Politique de confidentialité')

    await cleanup()
  })
})
