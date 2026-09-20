/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { WelcomeScreen } from './WelcomeScreen'
import {
  WELCOME_BETA,
  WELCOME_CTA,
  WELCOME_FABRIC_AVIF,
  WELCOME_FABRIC_WEBP,
  WELCOME_LOGO_ALT,
  WELCOME_LOGO_WEBP,
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
  it('affiche le copy français exact et le logo overlay (pas la texture)', async () => {
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

    const texture = host.querySelector('.welcome-screen__texture') as HTMLImageElement
    expect(texture.src).toContain(WELCOME_FABRIC_WEBP)
    expect(host.querySelector(`source[srcset="${WELCOME_FABRIC_AVIF}"]`)).toBeTruthy()

    const logo = host.querySelector('.welcome-screen__logo') as HTMLImageElement
    expect(logo.alt).toBe(WELCOME_LOGO_ALT)
    expect(logo.src).toContain(WELCOME_LOGO_WEBP)
    expect(logo.src).not.toContain('auth-welcome-fabric')

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
