/** @vitest-environment jsdom */
/**
 * IPA #131 (iPhone 17) — bandes noires L/R (~24px) + tab au-dessus d’une bande bas.
 *
 * Cause réelle (pas le letterbox LaunchScreen, status bar overlay OK) :
 * - Floating pill : `width: calc(100vw - 2.5rem)` → ~20–24 px de marge L/R
 * - `bottom: max(..., safe-area-inset-bottom)` → bande noire sous la tab
 *
 * Contrat : shell/root pleine largeur ; tab flush bas avec un seul safe-area interne.
 */
import { readFileSync } from 'node:fs'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BottomNav } from './BottomNav'
import { AppLayout } from './AppLayout'
import { RestTimerProvider } from '../../context/RestTimerContext'

vi.mock('../../backend/accueilGalleryFeatureFlag', () => ({
  isAccueilGalleryEnabled: () => true,
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ streakCelebration: null }),
}))

vi.mock('../../hooks/useAdaptiveBottomNav', () => ({
  useAdaptiveBottomNav: () => ({
    mode: 'expanded',
    keyboardOpen: false,
    expand: vi.fn(),
  }),
}))

describe('App shell / BottomNav — full-bleed (IPA #131)', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(() => {
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  it('floating pill : pleine largeur, bottom 0, safe-area uniquement en padding-bottom', async () => {
    await act(async () => {
      root.render(
        <BottomNav
          activeTab="home"
          onTabChange={vi.fn()}
          hasActiveWorkout={false}
          floatingPill
        />,
      )
    })
    const nav = host.querySelector(
      '[data-bottom-nav-variant="floating-pill"]',
    ) as HTMLElement | null
    expect(nav).toBeTruthy()
    expect(nav?.getAttribute('data-bottom-nav-edge')).toBe('flush')
    expect(nav?.className).toMatch(/\binset-x-0\b/)
    expect(nav?.className).toMatch(/\bbottom-0\b/)
    expect(nav?.className).not.toMatch(/left-1\/2/)
    expect(nav?.style.width).not.toMatch(/100vw\s*-\s*2\.5rem/)
    expect(nav?.style.bottom).toBe('')
    expect(nav?.style.paddingBottom).toMatch(/safe-area-inset-bottom/)
  })

  it('dock : flush bas + safe-area interne (pas left-3/right-3 ni bottom offset)', async () => {
    await act(async () => {
      root.render(
        <BottomNav
          activeTab="home"
          onTabChange={vi.fn()}
          hasActiveWorkout={false}
          floatingPill={false}
        />,
      )
    })
    const nav = host.querySelector(
      '[data-bottom-nav-variant="dock"]',
    ) as HTMLElement | null
    expect(nav).toBeTruthy()
    expect(nav?.getAttribute('data-bottom-nav-edge')).toBe('flush')
    expect(nav?.className).toMatch(/\binset-x-0\b/)
    expect(nav?.className).toMatch(/\bbottom-0\b/)
    expect(nav?.className).not.toMatch(/\bleft-3\b/)
    expect(nav?.className).not.toMatch(/\bright-3\b/)
    expect(nav?.style.paddingBottom).toMatch(/safe-area-inset-bottom/)
  })

  it('AppLayout shell : pleine largeur (pas de marge latérale sur le root shell)', async () => {
    await act(async () => {
      root.render(
        <RestTimerProvider>
          <AppLayout activeTab="home" onTabChange={vi.fn()}>
            <div>content</div>
          </AppLayout>
        </RestTimerProvider>,
      )
    })
    const shell = host.querySelector('[data-app-shell="1"]') as HTMLElement | null
    expect(shell).toBeTruthy()
    expect(shell?.getAttribute('data-app-shell-width')).toBe('full')
    expect(shell?.className).toMatch(/\bw-full\b/)
    expect(shell?.className).toMatch(/\bmax-w-none\b/)
    expect(shell?.className).not.toMatch(/\bpx-5\b/)
    expect(shell?.className).not.toMatch(/\bmx-auto\b/)
  })

  it('source BottomNav : plus de calc(100vw - 2.5rem) ni bottom:max(safe-area)', () => {
    const src = readFileSync('src/components/layout/BottomNav.tsx', 'utf8')
    // Only style assignments — comments may mention the old bug.
    expect(src).not.toMatch(/width:\s*'[^']*100vw\s*-\s*2\.5rem/)
    expect(src).not.toMatch(/bottom:\s*'max\(0\.[57]5rem/)
    expect(src).toMatch(/data-bottom-nav-edge="flush"/)
    expect(src).toMatch(/paddingBottom/)
  })
})
