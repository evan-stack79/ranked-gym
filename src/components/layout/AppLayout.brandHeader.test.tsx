/** @vitest-environment jsdom */
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppLayout } from './AppLayout'
import { shouldShowBrandHeader } from './shouldShowBrandHeader'
import { AuthStateProvider, type AuthContextValue } from '../../context/AuthContext'
import { RestTimerProvider } from '../../context/RestTimerContext'
import type { TabId } from '../../types'

vi.mock('../../assets/brand/panther-roaring.png', () => ({ default: 'panther.png' }))

function buildAuthValue(): AuthContextValue {
  return {
    user: null,
    profile: null,
    isAuthenticated: true,
    isLoading: false,
    bootIssue: null,
    retryHydrate: vi.fn(),
    isAuthOpen: false,
    authLoading: false,
    authError: null,
    authErrorCode: null,
    streakWeekBonus: null,
    clearStreakWeekBonus: vi.fn(),
    streakCelebration: null,
    clearStreakCelebration: vi.fn(),
    refreshProfile: vi.fn(),
    patchProfile: vi.fn(),
    openAuth: vi.fn(),
    closeAuth: vi.fn(),
    requireAuth: vi.fn(),
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    isPasswordRecovery: false,
    authInfo: null,
    clearAuthMessages: vi.fn(),
    requestPasswordReset: vi.fn(),
    confirmPasswordRecovery: vi.fn(),
    updateDiscipline: vi.fn(),
    updateGhostMode: vi.fn(),
    signOut: vi.fn(),
  }
}

function renderLayout(activeTab: TabId): { root: Root; host: HTMLDivElement } {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  const ui: ReactElement = (
    <AuthStateProvider value={buildAuthValue()}>
      <RestTimerProvider>
        <AppLayout activeTab={activeTab} onTabChange={vi.fn()}>
          <div data-testid="page-body">contenu</div>
        </AppLayout>
      </RestTimerProvider>
    </AuthStateProvider>
  )
  act(() => {
    root.render(ui)
  })
  return { root, host }
}

describe('shouldShowBrandHeader', () => {
  it('affiche Nutrition et Train, masque Accueil / Profil', () => {
    expect(shouldShowBrandHeader('nutrition')).toBe(true)
    expect(shouldShowBrandHeader('training')).toBe(true)
    expect(shouldShowBrandHeader('home')).toBe(false)
    expect(shouldShowBrandHeader('profile')).toBe(false)
  })

  it('reste masquée si chrome immersif (chromeHidden)', () => {
    expect(shouldShowBrandHeader('nutrition', true)).toBe(false)
    expect(shouldShowBrandHeader('training', true)).toBe(false)
  })
})

describe('AppLayout — barre marque sticky Nutrition / Train', () => {
  let root: Root
  let host: HTMLDivElement

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    host.remove()
  })

  function assertPinnedBrandHeader(tab: TabId) {
    ;({ root, host } = renderLayout(tab))
    const header = host.querySelector('[data-app-brand-header="1"]') as HTMLElement | null
    const main = host.querySelector('[data-app-scroll-main="1"]') as HTMLElement | null
    expect(header).not.toBeNull()
    expect(main).not.toBeNull()
    // Pin réel : hors du conteneur de scroll (pas un sticky fragile dans main).
    expect(main?.contains(header)).toBe(false)
    expect(header?.previousElementSibling).toBeNull()
    expect(header?.nextElementSibling).toBe(main)
    expect(header?.className).toContain('sticky')
    expect(header?.className).toContain('top-0')
    expect(header?.className).toContain('shrink-0')
    expect(main?.className).toMatch(/overflow-y-auto/)
    expect(main?.className).toMatch(/overscroll-y-contain/)
    expect(host.querySelector('nav[aria-label="Navigation principale"]')).not.toBeNull()
    // Safe-area seule sur le header — pas de max(fixe, safe-area) empilé sur l’inner.
    expect(header?.style.paddingTop).toContain('safe-area-inset-top')
    expect(header?.style.paddingTop).not.toContain('0.75rem')
    const inner = header?.querySelector(':scope > div') as HTMLElement | null
    expect(inner).not.toBeNull()
    expect(inner?.style.paddingTop).toBe('')
    expect(inner?.className).toMatch(/\bpt-1\.5\b/)
    expect(inner?.className).toMatch(/\bpb-2\b/)
    expect(inner?.className).not.toMatch(/\bpy-3\b/)
  }

  it('monte une barre pinée (hors scroll) sur Nutrition', () => {
    assertPinnedBrandHeader('nutrition')
  })

  it('monte une barre pinée (hors scroll) sur Train', () => {
    assertPinnedBrandHeader('training')
  })

  it('n’affiche pas la barre sur Accueil (home)', () => {
    ;({ root, host } = renderLayout('home'))
    expect(host.querySelector('[data-app-brand-header]')).toBeNull()
    expect(host.querySelector('nav[aria-label="Navigation principale"]')).not.toBeNull()
    const content = host.querySelector('.mx-auto.w-full.max-w-lg') as HTMLElement | null
    expect(content).not.toBeNull()
    expect(content?.style.paddingTop).toContain('safe-area-inset-top')
  })

  it('n’affiche pas la barre sur Profil', () => {
    ;({ root, host } = renderLayout('profile'))
    expect(host.querySelector('[data-app-brand-header]')).toBeNull()
    expect(host.querySelector('nav[aria-label="Navigation principale"]')).not.toBeNull()
  })
})
