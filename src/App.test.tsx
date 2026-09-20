/** @vitest-environment jsdom */
import { createRoot } from 'react-dom/client'
import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { AppShell } from './App'
import { AuthStateProvider } from './context/AuthContext'
import { RestTimerProvider } from './context/RestTimerContext'
import { buildAuthContextValue, FIXTURE_AUTH_USER } from './test/authFixtureValue'
import { WELCOME_TITLE } from './components/auth/welcomeCopy'
import { saveCalorieProfile } from './services/nutritionStorage'

vi.mock('./assets/brand/panther-roaring.png', () => ({ default: 'panther.png' }))

async function renderShell(overrides: Parameters<typeof buildAuthContextValue>[0] = {}) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  const value = buildAuthContextValue({
    openAuth: vi.fn(),
    closeAuth: vi.fn(),
    ...overrides,
  })
  await act(async () => {
    root.render(
      <AuthStateProvider value={value}>
        <RestTimerProvider>
          <AppShell />
        </RestTimerProvider>
      </AuthStateProvider>,
    )
  })
  return {
    host,
    value,
    async cleanup() {
      await act(async () => {
        root.unmount()
      })
      host.remove()
    },
  }
}

describe('AppShell auth welcome', () => {
  it('ne montre pas l’accueil pendant la restauration de session', async () => {
    const { host, cleanup } = await renderShell({ isLoading: true, isAuthenticated: false })
    expect(host.querySelector('[data-session-restore]')).toBeTruthy()
    expect(host.querySelector('[data-welcome-screen]')).toBeNull()
    expect(host.textContent).not.toContain(WELCOME_TITLE)
    expect(host.textContent).not.toContain('Récupération des données')
    expect(host.textContent).not.toContain('Chargement')
    expect(host.textContent).not.toContain('VITE_')
    await cleanup()
  })

  it('affiche l’accueil seulement si déconnecté, sans ouvrir la feuille', async () => {
    const openAuth = vi.fn()
    const { host, cleanup } = await renderShell({
      isLoading: false,
      isAuthenticated: false,
      isAuthOpen: false,
      openAuth,
    })
    expect(host.querySelector('[data-welcome-screen]')).toBeTruthy()
    expect(host.textContent).toContain(WELCOME_TITLE)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(openAuth).not.toHaveBeenCalled()
    const cta = [...host.querySelectorAll('button')].find((el) => el.textContent === 'Se connecter')
    await act(async () => {
      cta?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(openAuth).toHaveBeenCalledTimes(1)
    await cleanup()
  })

  it('session déjà valide → pas d’accueil, entrée dans l’app', async () => {
    saveCalorieProfile(
      {
        weightKg: 78,
        goalWeightKg: 75,
        heightCm: 178,
        age: 28,
        sex: 'male',
        activity: 'active',
        morphology: 'mesomorph',
        goal: 'cut',
        weeklyPaceKg: 0.4,
        onboardingComplete: true,
      },
      { skipCloud: true },
    )
    const { host, cleanup } = await renderShell({
      isLoading: false,
      isAuthenticated: true,
      user: FIXTURE_AUTH_USER,
    })
    expect(host.querySelector('[data-welcome-screen]')).toBeNull()
    expect(host.textContent).not.toContain(WELCOME_TITLE)
    expect(
      host.querySelector('[data-app-brand-header]') || host.textContent?.includes('Ton plan'),
    ).toBeTruthy()
    await cleanup()
  })
})
