/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ACCUEIL_FLIP_MS,
  captureSlotRects,
  flipDelta,
  playFlipTranslate,
  runFlipFromFirst,
  shouldAnimateFlip,
} from './accueilFlip'

describe('accueilFlip math', () => {
  it('flipDelta is First − Last', () => {
    expect(flipDelta({ left: 100, top: 40 }, { left: 20, top: 60 })).toEqual({
      dx: 80,
      dy: -20,
    })
  })

  it('shouldAnimateFlip ignores sub-pixel noise', () => {
    expect(shouldAnimateFlip(0.2, 0.1)).toBe(false)
    expect(shouldAnimateFlip(1, 0)).toBe(true)
    expect(shouldAnimateFlip(0, -2)).toBe(true)
  })
})

describe('accueilFlip WAAPI', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('playFlipTranslate is a no-op when delta is tiny and scale unchanged', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const animate = vi.fn()
    el.animate = animate
    expect(playFlipTranslate(el, 0.1, 0.2)).toBeNull()
    expect(animate).not.toHaveBeenCalled()
  })

  it('playFlipTranslate uses transform-only keyframes at FLIP duration', () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    const finished = Promise.resolve()
    const anim = {
      finished,
      cancel: vi.fn(),
    }
    el.animate = vi.fn(() => anim as unknown as Animation)
    el.getAnimations = () => []

    const result = playFlipTranslate(el, 40, -12, { ms: ACCUEIL_FLIP_MS })
    expect(result).toBe(anim)
    expect(el.animate).toHaveBeenCalledWith(
      [
        { transform: 'translate3d(40px, -12px, 0) scale(1)' },
        { transform: 'translate3d(0, 0, 0) scale(1)' },
      ],
      expect.objectContaining({
        duration: ACCUEIL_FLIP_MS,
        fill: 'both',
      }),
    )
  })

  it('runFlipFromFirst clears transform before measuring Last (interruptible)', () => {
    const root = document.createElement('div')
    const a = document.createElement('div')
    a.setAttribute('data-accueil-edit-slot', 'eau')
    // Mid-FLIP leftover — must be cleared before Last.
    a.style.transform = 'translate3d(80px, 0, 0)'
    root.appendChild(a)
    document.body.appendChild(root)

    a.getAnimations = () => []
    const animate = vi.fn(() => {
      const finished = Promise.resolve()
      return { finished, cancel: vi.fn() } as unknown as Animation
    })
    a.animate = animate

    const first = new Map<string, DOMRect>([
      [
        'eau',
        {
          left: 100,
          top: 50,
          right: 200,
          bottom: 150,
          width: 100,
          height: 100,
          x: 100,
          y: 50,
          toJSON: () => ({}),
        } as DOMRect,
      ],
    ])

    // Stub Last after clear: layout at left=20 (would be 100 if transform kept).
    const rects = [
      // First call inside runFlipFromFirst after clear
      {
        left: 20,
        top: 50,
        right: 120,
        bottom: 150,
        width: 100,
        height: 100,
        x: 20,
        y: 50,
        toJSON: () => ({}),
      } as DOMRect,
    ]
    vi.spyOn(a, 'getBoundingClientRect').mockImplementation(() => rects[0]!)

    runFlipFromFirst(root, first, { ms: ACCUEIL_FLIP_MS })

    // Invert should be 100 − 20 = 80 (not 0 from uncleared transform).
    expect(animate).toHaveBeenCalledWith(
      [
        { transform: 'translate3d(80px, 0px, 0) scale(1)' },
        { transform: 'translate3d(0, 0, 0) scale(1)' },
      ],
      expect.objectContaining({ duration: ACCUEIL_FLIP_MS }),
    )
  })

  it('runFlipFromFirst skips the dragged id', () => {
    const root = document.createElement('div')
    const a = document.createElement('div')
    a.setAttribute('data-accueil-edit-slot', 'eau')
    root.appendChild(a)
    document.body.appendChild(root)
    a.getAnimations = () => []
    a.animate = vi.fn()

    const first = captureSlotRects(root)
    runFlipFromFirst(root, first, { skipId: 'eau' })
    expect(a.animate).not.toHaveBeenCalled()
  })

  it('reduced-motion path: callers skip runFlip (no transition contract)', () => {
    // Document the app rule: prefers-reduced-motion → no movement animation.
    // HomeGalleryView gates with prefersReducedMotion before calling runFlipFromFirst.
    expect(ACCUEIL_FLIP_MS).toBeGreaterThan(0)
    expect(shouldAnimateFlip(80, 0)).toBe(true)
  })
})
