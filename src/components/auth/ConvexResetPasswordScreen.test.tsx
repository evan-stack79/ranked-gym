/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'
import { ConvexResetPasswordScreen } from './ConvexResetPasswordScreen'

function setRoute(path: string) {
  window.history.replaceState({}, '', path)
}

async function renderScreen() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  await act(async () => {
    root.render(<ConvexResetPasswordScreen />)
  })
  await act(async () => {
    await Promise.resolve()
  })
  return {
    host,
    root,
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

describe('ConvexResetPasswordScreen', () => {
  it('retire le token de l’URL quand il est présent', async () => {
    setRoute('/auth/reset-password?token=tok-123456789012')
    const { cleanup } = await renderScreen()
    expect(window.location.search).not.toContain('token=')
    expect(document.body.textContent).not.toMatch(/lien de réinitialisation invalide/i)
    await cleanup()
  })

  it('affiche une erreur explicite si le token est manquant', async () => {
    setRoute('/auth/reset-password')
    const { cleanup } = await renderScreen()
    expect(document.body.textContent).toMatch(/lien de réinitialisation invalide/i)
    await cleanup()
  })

  it('affiche une erreur expiré/déjà utilisé pour un token manifestement invalide', async () => {
    setRoute('/auth/reset-password?token=short-token')
    const { cleanup } = await renderScreen()
    expect(document.body.textContent).toMatch(/lien expiré ou déjà utilisé/i)
    await cleanup()
  })
})
