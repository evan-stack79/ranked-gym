/** @vitest-environment jsdom */
/**
 * Accueil edit chrome pin: OK / + Ajouter live outside the scroll main
 * (fixed pin host), stay present after scroll, tappable.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

vi.mock('../../hooks/usePrefersReducedMotion', () => ({
  usePrefersReducedMotion: () => false,
}))

vi.mock('../../hooks/useInViewOnce', () => ({
  useInViewOnce: () => ({ ref: { current: null }, inView: true }),
}))

vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { firstName: 'Alex', displayName: 'Alex' },
    profile: { pseudo: 'Alex' },
    isLoading: false,
  }),
}))

vi.mock('../../services/nutritionStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/nutritionStorage')>()
  return {
    ...actual,
    getTodayWaterMl: () => 1200,
  }
})

vi.mock('../../services/trainingStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/trainingStorage')>()
  return {
    ...actual,
    getTrainingState: () => ({
      ...actual.getTrainingState(),
      primarySportId: 'musculation',
      favoriteSportIds: ['musculation'],
      schedule: [],
      workoutNotes: [],
      routines: [],
      sportsOnboardingComplete: true,
      lastVoluntaryRoute: 'train-hub',
    }),
  }
})

describe('HomeGalleryView edit chrome pin', () => {
  let host: HTMLDivElement
  let shell: HTMLDivElement
  let pinHost: HTMLDivElement
  let main: HTMLDivElement
  let root: Root

  beforeEach(() => {
    localStorage.clear()
    shell = document.createElement('div')
    shell.setAttribute('data-app-shell', '1')
    pinHost = document.createElement('div')
    pinHost.setAttribute('data-app-top-pin-host', '1')
    main = document.createElement('div')
    main.setAttribute('data-app-scroll-main', '1')
    main.style.overflow = 'auto'
    main.style.height = '400px'
    host = document.createElement('div')
    main.appendChild(host)
    shell.appendChild(pinHost)
    shell.appendChild(main)
    document.body.appendChild(shell)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    shell.remove()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('portals OK / + Ajouter into the top pin host as a fixed bar in edit mode', async () => {
    const { HomeGalleryView } = await import('./HomeGalleryView')

    await act(async () => {
      root.render(
        <HomeGalleryView
          onStartTraining={() => {}}
          onOpenTraining={() => {}}
          onOpenHistory={() => {}}
        />,
      )
    })

    const openBtn = host.querySelector('[data-accueil-edit-open-footer]') as HTMLButtonElement
    expect(openBtn).toBeTruthy()
    await act(async () => {
      openBtn.click()
    })

    expect(host.querySelector('[data-accueil-edit-open="1"]')).toBeTruthy()
    const pin = pinHost.querySelector('[data-accueil-edit-chrome-pin="1"]') as HTMLElement
    expect(pin).toBeTruthy()
    expect(pin.querySelector('[data-accueil-edit-ok]')).toBeTruthy()
    expect(pin.querySelector('[data-accueil-edit-add]')).toBeTruthy()

    // Pin host is a sibling of the scroll main — not inside it.
    expect(main.contains(pin)).toBe(false)
    expect(pinHost.contains(pin)).toBe(true)

    // CSS contract: fixed + pass-through plate (buttons re-enable pointer-events).
    expect(css).toMatch(/\.accueil-edit-chrome-pin\s*\{[^}]*position:\s*fixed/s)
    expect(css).toMatch(/\.accueil-edit-chrome-pin\s*\{[^}]*pointer-events:\s*none/s)
    expect(css).toMatch(
      /safe-area-inset-top|var\(--app-safe-area-top/,
    )

    // In-flow spacer reserves height; real buttons are not duplicated in gallery.
    expect(host.querySelector('[data-accueil-edit-chrome-spacer="1"]')).toBeTruthy()
    expect(host.querySelector('[data-accueil-edit-ok]')).toBeNull()
  })

  it('keeps pin buttons present and tappable after scrolling the main scroller', async () => {
    const { HomeGalleryView } = await import('./HomeGalleryView')

    await act(async () => {
      root.render(
        <HomeGalleryView
          onStartTraining={() => {}}
          onOpenTraining={() => {}}
          onOpenHistory={() => {}}
        />,
      )
    })

    await act(async () => {
      ;(host.querySelector('[data-accueil-edit-open-footer]') as HTMLButtonElement).click()
    })

    main.scrollTop = 800
    expect(main.scrollTop).toBe(800)

    const ok = pinHost.querySelector('[data-accueil-edit-ok]') as HTMLButtonElement
    const add = pinHost.querySelector('[data-accueil-edit-add]') as HTMLButtonElement
    expect(ok).toBeTruthy()
    expect(add).toBeTruthy()

    await act(async () => {
      add.click()
    })
    // Add sheet opens from scrolled position (empty list when nothing hidden).
    expect(
      host.querySelector('[data-accueil-add-empty]') ??
        document.querySelector('[data-accueil-add-empty], [data-accueil-add-item]'),
    ).toBeTruthy()

    await act(async () => {
      ok.click()
    })
    expect(host.querySelector('[data-accueil-edit-open="0"]')).toBeTruthy()
    expect(pinHost.querySelector('[data-accueil-edit-chrome-pin="1"]')).toBeNull()
    // Scroll position not reset by OK.
    expect(main.scrollTop).toBe(800)
  })
})
