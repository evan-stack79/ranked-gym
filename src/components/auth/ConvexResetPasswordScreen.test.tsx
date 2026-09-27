/** @vitest-environment jsdom */
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConvexResetPasswordScreen } from './ConvexResetPasswordScreen'

const { requestPasswordResetMock, updatePasswordMock } = vi.hoisted(() => ({
  requestPasswordResetMock: vi.fn(),
  updatePasswordMock: vi.fn(),
}))

vi.mock('../../services/authService', () => ({
  updatePassword: updatePasswordMock,
  requestPasswordReset: requestPasswordResetMock,
}))

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
  beforeEach(() => {
    requestPasswordResetMock.mockReset()
    updatePasswordMock.mockReset()
  })

  it('affiche un bouton "Renvoyer le lien" quand le token est manquant', async () => {
    requestPasswordResetMock.mockResolvedValue({ accepted: true, delivery: 'email' })
    setRoute('/auth/reset-password')
    const { cleanup } = await renderScreen()
    expect(document.body.textContent).toContain('Renvoyer le lien')
    await cleanup()
  })

  it('affiche le message support quand l’email reset n’est pas configuré', async () => {
    requestPasswordResetMock.mockResolvedValue({ accepted: true, delivery: 'manual' })
    setRoute('/auth/reset-password')
    const { host, cleanup } = await renderScreen()
    const emailInput = host.querySelector('input[type="email"]') as HTMLInputElement | null
    const resend = [...host.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Renvoyer le lien'),
    ) as HTMLButtonElement | undefined

    expect(emailInput).toBeTruthy()
    await act(async () => {
      if (emailInput) {
        const setter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          'value',
        )?.set
        setter?.call(emailInput, 'athlete@example.com')
        emailInput.dispatchEvent(new Event('input', { bubbles: true }))
      }
    })
    await act(async () => {
      resend?.click()
    })

    expect(requestPasswordResetMock).toHaveBeenCalled()
    expect(document.body.textContent).toContain('Contacte le support pour recevoir un lien')
    await cleanup()
  })

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
