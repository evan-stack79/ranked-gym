// @vitest-environment jsdom
import { StrictMode, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { act } from 'react'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import '../../index.css'
import {
  STREAK_CELEB_REDUCED_MS,
  StreakCelebrationOverlay,
} from './StreakCelebrationOverlay'
import { StreakCelebrationHost } from './StreakCelebrationHost'
import { AppLayout } from '../layout/AppLayout'
import {
  AuthStateProvider,
  type StreakCelebration,
  type AuthContextValue,
} from '../../context/AuthContext'
import { RestTimerProvider } from '../../context/RestTimerContext'
import {
  __getBodyScrollLockCountForTests,
  __resetBodyScrollLockForTests,
} from '../../utils/bodyScrollLock'
import { __resetStreakCelebrationSessionForTests } from '../../utils/streakCelebrationSession'

vi.mock('../../assets/brand/panther-roaring.png', () => ({ default: 'panther.png' }))

function mockReducedMotion() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function render(ui: ReactElement): { root: Root; container: HTMLDivElement } {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  act(() => {
    root.render(ui)
  })
  return { root, container }
}

function unmount(root: Root, container: HTMLDivElement) {
  act(() => {
    root.unmount()
  })
  container.remove()
}

function buildMinimalAuthValue(
  streakCelebration: StreakCelebration | null,
  clear: () => void,
): AuthContextValue {
  return {
    user: null,
    profile: null,
    isAuthenticated: true,
    isLoading: false,
    isAuthOpen: false,
    authLoading: false,
    authError: null,
    streakWeekBonus: null,
    clearStreakWeekBonus: vi.fn(),
    streakCelebration,
    clearStreakCelebration: clear,
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

function CelebrationIntegrationApp({
  initialCelebration,
  deferCelebration = false,
}: {
  initialCelebration: StreakCelebration
  deferCelebration?: boolean
}) {
  const [streakCelebration, setStreakCelebration] = useState<StreakCelebration | null>(
    deferCelebration ? null : initialCelebration,
  )

  useEffect(() => {
    if (deferCelebration) {
      setStreakCelebration(initialCelebration)
    }
  }, [deferCelebration, initialCelebration])

  const authValue = useMemo(
    () => buildMinimalAuthValue(streakCelebration, () => setStreakCelebration(null)),
    [streakCelebration],
  )

  return (
    <AuthStateProvider value={authValue}>
      <RestTimerProvider>
        <AppLayout activeTab="home" onTabChange={vi.fn()}>
          <div className="streak-card overflow-hidden rounded-2xl border border-white/10 px-4 py-3.5">
            <p>Daily Streak card</p>
          </div>
        </AppLayout>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

describe('StreakCelebrationOverlay — portal DOM', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    __resetBodyScrollLockForTests()
    __resetStreakCelebrationSessionForTests()
    vi.useFakeTimers()
    mockReducedMotion()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('monte le dialog en enfant direct de document.body', () => {
    const onComplete = vi.fn()
    const { root, container } = render(
      <StreakCelebrationOverlay
        previousStreak={6}
        currentStreak={7}
        dateKey="2026-08-30"
        onComplete={onComplete}
        forceReducedMotion
      />,
    )

    const dialog = document.body.querySelector('[role="dialog"].streak-celeb')
    expect(dialog).not.toBeNull()
    expect(dialog?.parentElement).toBe(document.body)
    expect(container.querySelector('.streak-celeb')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(STREAK_CELEB_REDUCED_MS)
    })
    expect(onComplete).toHaveBeenCalledTimes(1)

    unmount(root, container)
  })

  it('z-index au-dessus du maximum applicatif (10000)', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    const css = readFileSync(join(rootDir, 'index.css'), 'utf8')
    const block = css.slice(css.indexOf('.streak-celeb {'))
    expect(block).toMatch(/z-index:\s*10000/)
    expect(block).toMatch(/width:\s*100dvw/)
    expect(block).toMatch(/height:\s*100dvh/)
    expect(block).toMatch(/var\(--app-safe-area-top\)/)
    expect(block).toMatch(/var\(--app-safe-area-bottom\)/)

    const { root, container } = render(
      <StreakCelebrationOverlay
        previousStreak={1}
        currentStreak={2}
        dateKey="2026-08-30"
        onComplete={vi.fn()}
        forceReducedMotion
      />,
    )

    expect(document.body.querySelector('.streak-celeb')).not.toBeNull()
    unmount(root, container)
  })
})

describe('StreakCelebrationHost — session lifecycle', () => {
  const initialCelebration: StreakCelebration = {
    previousStreak: 6,
    currentStreak: 7,
    dateKey: '2026-08-30',
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    __resetBodyScrollLockForTests()
    __resetStreakCelebrationSessionForTests()
    vi.useFakeTimers()
    mockReducedMotion()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function renderHost(initial = initialCelebration) {
    function HostHarness() {
      const shellRef = useRef<HTMLDivElement>(null)
      const [celebration, setCelebration] = useState<StreakCelebration | null>(initial)
      const authValue = useMemo(
        () => buildMinimalAuthValue(celebration, () => setCelebration(null)),
        [celebration],
      )

      return (
        <AuthStateProvider value={authValue}>
          <div
            ref={shellRef}
            data-test-shell
            className="mesh-bg"
            inert={celebration ? true : undefined}
          >
            <StreakCelebrationHost shellRef={shellRef} />
          </div>
        </AuthStateProvider>
      )
    }

    return render(<HostHarness />)
  }

  it('verrouille le scroll, pose inert sur le shell, et restaure à la fermeture', async () => {
    const { root, container } = renderHost()
    const shell = container.querySelector('[data-test-shell]') as HTMLDivElement

    expect(document.body.style.overflow).toBe('hidden')
    expect(shell.hasAttribute('inert')).toBe(true)
    expect(document.body.querySelector('.streak-celeb')).not.toBeNull()

    await act(async () => {
      vi.advanceTimersByTime(STREAK_CELEB_REDUCED_MS)
      await Promise.resolve()
    })

    expect(document.body.querySelector('.streak-celeb')).toBeNull()
    expect(document.body.style.overflow).toBe('')
    expect(shell.hasAttribute('inert')).toBe(false)

    unmount(root, container)
    expect(__getBodyScrollLockCountForTests()).toBe(0)
  })

  it('restaure le focus BottomNav après réapparition (post-commit)', async () => {
    function HostWithNav() {
      const [celebration, setCelebration] = useState<StreakCelebration | null>(null)
      const authValue = useMemo(
        () => buildMinimalAuthValue(celebration, () => setCelebration(null)),
        [celebration],
      )

      useEffect(() => {
        setCelebration(initialCelebration)
      }, [])

      return (
        <AuthStateProvider value={authValue}>
          <RestTimerProvider>
            <AppLayout activeTab="home" onTabChange={vi.fn()}>
              <p>Accueil</p>
            </AppLayout>
          </RestTimerProvider>
        </AuthStateProvider>
      )
    }

    const { root, container } = render(<HostWithNav />)
    const navBtn = document.querySelector(
      'nav[aria-label="Navigation principale"] button',
    ) as HTMLButtonElement
    expect(navBtn).not.toBeNull()
    navBtn.focus()

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      vi.advanceTimersByTime(STREAK_CELEB_REDUCED_MS)
      await Promise.resolve()
    })

    expect(document.activeElement).toBe(navBtn)
    expect(document.querySelector('[data-bottom-nav-host]')?.hasAttribute('inert')).toBe(false)
    unmount(root, container)
  })

  it('finalize idempotent — un seul clear même si onComplete appelé deux fois', async () => {
    const clearSpy = vi.fn()
    function HostHarness() {
      const shellRef = useRef<HTMLDivElement>(null)
      const [celebration, setCelebration] = useState<StreakCelebration | null>(initialCelebration)
      const authValue = useMemo(
        () =>
          buildMinimalAuthValue(celebration, () => {
            clearSpy()
            setCelebration(null)
          }),
        [celebration],
      )

      return (
        <AuthStateProvider value={authValue}>
          <div ref={shellRef}>
            <StreakCelebrationHost shellRef={shellRef} />
          </div>
        </AuthStateProvider>
      )
    }

    const { root, container } = render(<HostHarness />)

    await act(async () => {
      vi.advanceTimersByTime(STREAK_CELEB_REDUCED_MS)
    })

    const dialog = document.body.querySelector('.streak-celeb') as HTMLElement
    act(() => {
      dialog?.click()
    })

    expect(clearSpy).toHaveBeenCalledTimes(1)
    unmount(root, container)
  })

  it('restaure une seule fois sous StrictMode (remount sans clear prématuré)', async () => {
    const clearSpy = vi.fn()
    function HostHarness() {
      const shellRef = useRef<HTMLDivElement>(null)
      const [celebration, setCelebration] = useState<StreakCelebration | null>(initialCelebration)
      const authValue = useMemo(
        () =>
          buildMinimalAuthValue(celebration, () => {
            clearSpy()
            setCelebration(null)
          }),
        [celebration],
      )

      return (
        <AuthStateProvider value={authValue}>
          <div
            ref={shellRef}
            data-test-shell
            inert={celebration ? true : undefined}
          >
            <StreakCelebrationHost shellRef={shellRef} />
          </div>
        </AuthStateProvider>
      )
    }

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    act(() => {
      root.render(
        <StrictMode>
          <HostHarness />
        </StrictMode>,
      )
    })

    const shell = container.querySelector('[data-test-shell]') as HTMLDivElement
    expect(clearSpy).not.toHaveBeenCalled()
    expect(document.body.querySelector('.streak-celeb')).not.toBeNull()
    expect(__getBodyScrollLockCountForTests()).toBe(1)
    expect(document.body.style.overflow).toBe('hidden')
    expect(shell.hasAttribute('inert')).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(STREAK_CELEB_REDUCED_MS)
      await Promise.resolve()
    })

    expect(clearSpy).toHaveBeenCalledTimes(1)
    unmount(root, container)
  })

  it('locks concurrents — compteur scroll à zéro après fermeture', async () => {
    const { root, container } = renderHost()
    expect(__getBodyScrollLockCountForTests()).toBe(1)

    await act(async () => {
      vi.advanceTimersByTime(STREAK_CELEB_REDUCED_MS)
    })

    expect(__getBodyScrollLockCountForTests()).toBe(0)
    unmount(root, container)
  })
})

describe('AppLayout — BottomNav pendant célébration', () => {
  const initialCelebration: StreakCelebration = {
    previousStreak: 2,
    currentStreak: 3,
    dateKey: '2026-08-30',
  }

  beforeEach(() => {
    document.body.innerHTML = ''
    __resetStreakCelebrationSessionForTests()
    mockReducedMotion()
  })

  it('masque BottomNav (montée, inert/invisible) et marque le shell actif', () => {
    const { root, container } = render(
      <CelebrationIntegrationApp initialCelebration={initialCelebration} />,
    )

    const navHost = document.querySelector('[data-bottom-nav-host]')
    expect(navHost).not.toBeNull()
    expect(navHost?.hasAttribute('inert')).toBe(true)
    expect(navHost?.classList.contains('invisible')).toBe(true)
    expect(document.querySelector('nav[aria-label="Navigation principale"]')).not.toBeNull()
    expect(
      container.querySelector('[data-streak-celebration-active]'),
    ).not.toBeNull()
    expect(document.body.querySelector('.streak-celeb')).not.toBeNull()

    unmount(root, container)
  })

  it('clearStreakCelebration intégré — dialog, nav, inert, scroll et focus', async () => {
    vi.useFakeTimers()

    const { root, container } = render(
      <CelebrationIntegrationApp initialCelebration={initialCelebration} deferCelebration />,
    )

    const shell = container.querySelector('[data-streak-celebration-active]') as HTMLDivElement
    const navBtn = document.querySelector(
      'nav[aria-label="Navigation principale"] button',
    ) as HTMLButtonElement
    expect(navBtn).not.toBeNull()
    navBtn.focus()

    await act(async () => {
      await Promise.resolve()
    })

    expect(document.body.style.overflow).toBe('hidden')
    expect(shell.hasAttribute('inert')).toBe(true)

    await act(async () => {
      vi.advanceTimersByTime(STREAK_CELEB_REDUCED_MS)
      await Promise.resolve()
    })

    expect(document.body.querySelector('.streak-celeb')).toBeNull()
    expect(container.querySelector('[data-streak-celebration-active]')).toBeNull()
    expect(document.querySelector('[data-bottom-nav-host]')?.hasAttribute('inert')).toBe(false)
    expect(document.querySelector('[data-bottom-nav-host]')?.classList.contains('invisible')).toBe(
      false,
    )
    expect(document.body.style.overflow).toBe('')
    expect(document.activeElement).toBe(navBtn)

    vi.useRealTimers()
    unmount(root, container)
  })
})

describe('DailyStreak — pas de montage local overlay', () => {
  it('ne référence plus StreakCelebrationOverlay', async () => {
    const { readFileSync } = await import('node:fs')
    const { dirname, join } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const root = join(dirname(fileURLToPath(import.meta.url)), '..')
    const daily = readFileSync(join(root, 'home/DailyStreak.tsx'), 'utf8')
    expect(daily).not.toMatch(/StreakCelebrationOverlay/)
  })
})
