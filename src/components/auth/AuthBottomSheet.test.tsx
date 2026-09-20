/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AuthBottomSheet } from './AuthBottomSheet'
import { AuthStateProvider } from '../../context/AuthContext'
import { buildAuthContextValue } from '../../test/authFixtureValue'

async function renderSheet(overrides: Parameters<typeof buildAuthContextValue>[0] = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const value = buildAuthContextValue({
    isAuthOpen: true,
    closeAuth: vi.fn(),
    signInWithEmail: vi.fn(),
    ...overrides,
  })
  await act(async () => {
    root.render(
      <AuthStateProvider value={value}>
        <AuthBottomSheet />
      </AuthStateProvider>,
    )
  })
  return {
    value,
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

describe('AuthBottomSheet', () => {
  it('reste dismissible hors recovery et garde mot de passe oublié', async () => {
    const closeAuth = vi.fn()
    const { cleanup } = await renderSheet({
      isAuthenticated: false,
      isAuthOpen: true,
      closeAuth,
    })
    const dialog = document.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(document.body.textContent).toContain('Mot de passe oublié ?')
    expect(document.body.textContent).not.toMatch(/créer un compte|inscription publique/i)
    const close = document.querySelector(
      '[role="dialog"] button[aria-label="Fermer"]',
    ) as HTMLButtonElement
    expect(close.disabled).toBe(false)
    await act(async () => {
      close.click()
    })
    expect(closeAuth).toHaveBeenCalled()
    await cleanup()
  })

  it('affiche une erreur compacte sous le champ, pas une carte rouge', async () => {
    const { cleanup } = await renderSheet({
      isAuthOpen: true,
      authError: 'Email ou mot de passe incorrect.',
    })
    const err = document.querySelector('[data-auth-error="1"]')
    expect(err?.textContent).toBe('Email ou mot de passe incorrect.')
    expect(err?.className).not.toMatch(/border-\[#FF453A\]/)
    expect(err?.className).not.toMatch(/bg-\[#FF453A\]/)
    await cleanup()
  })

  it('ouvre le flux mot de passe oublié', async () => {
    const { cleanup } = await renderSheet({ isAuthOpen: true })
    const forgot = [...document.querySelectorAll('button')].find((el) =>
      el.textContent?.includes('Mot de passe oublié'),
    )
    await act(async () => {
      forgot?.click()
    })
    expect(document.body.textContent).toContain('Mot de passe oublié')
    expect(document.body.textContent).toContain('Envoyer le lien')
    await cleanup()
  })
})
