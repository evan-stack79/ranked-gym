import { useEffect, useRef, useState } from 'react'

export const COLD_LAUNCH_CALM_SRC = '/brand-splash-calm.png'
export const COLD_LAUNCH_ROAR_SRC = '/brand-splash-roar.png'

// Ideal full-motion envelope is 1400ms: readable calm/roar, a short centered
// breath, then 520ms FLIP. MAX=1500 absorbs decode/boot jitter in
// coldLaunchDeadlineMs without leaving the 1.3–1.5s iPhone-test window.
export const COLD_LAUNCH_MIN_MS = 1300
export const COLD_LAUNCH_MAX_MS = 1500
export const COLD_LAUNCH_TOTAL_MS = 1400

const ROAR_AT_RATIO = 180 / COLD_LAUNCH_TOTAL_MS
const MORPH_AT_RATIO = 460 / COLD_LAUNCH_TOTAL_MS
const BACK_TO_CALM_AT_RATIO = 540 / COLD_LAUNCH_TOTAL_MS
const CENTER_WORDMARK_FADE_AT_RATIO = 460 / COLD_LAUNCH_TOTAL_MS
const REVEAL_AT_RATIO = 720 / COLD_LAUNCH_TOTAL_MS
const HANDOFF_AT_RATIO = 980 / COLD_LAUNCH_TOTAL_MS
const FLIP_START_AT_RATIO = 460 / COLD_LAUNCH_TOTAL_MS
const FLIP_DURATION_MS = 520

type LaunchPhase = 'calm' | 'roar' | 'morphing' | 'handoff' | 'exiting' | 'done'

type RectLike = Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>

declare global {
  interface Window {
    __RG_BOOT_T0__?: number
  }
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function isDecodedImage(img: HTMLImageElement | null): boolean {
  return Boolean(img && img.complete && img.naturalWidth > 0)
}

async function waitForDecoded(src: string, signal?: { cancelled: boolean }): Promise<boolean> {
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = src
    if (img.decode) {
      await img.decode()
    } else {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('load failed'))
      })
    }
    if (signal?.cancelled) return false
    return img.complete && img.naturalWidth > 0
  } catch {
    return false
  }
}

export function documentBootOriginMs(): number {
  if (typeof window === 'undefined') return 0
  if (typeof window.__RG_BOOT_T0__ === 'number' && Number.isFinite(window.__RG_BOOT_T0__)) {
    return window.__RG_BOOT_T0__
  }
  return 0
}

export function coldLaunchDeadlineMs(now = performance.now()): {
  roarAt: number
  morphAt: number
  backToCalmAt: number
  centerWordmarkFadeAt: number
  revealAt: number
  flipStartAt: number
  handoffAt: number
  doneAt: number
  totalMs: number
} {
  const origin = documentBootOriginMs()
  const idealDone = origin + COLD_LAUNCH_TOTAL_MS
  const minDone = origin + COLD_LAUNCH_MIN_MS
  const maxDone = origin + COLD_LAUNCH_MAX_MS
  const earliestDone = now + 360
  const doneAt = Math.min(maxDone, Math.max(minDone, Math.max(earliestDone, idealDone)))
  const totalMs = Math.max(360, doneAt - origin)
  const roarAt = origin + totalMs * ROAR_AT_RATIO
  const morphAt = origin + totalMs * MORPH_AT_RATIO
  const backToCalmAt = origin + totalMs * BACK_TO_CALM_AT_RATIO
  const centerWordmarkFadeAt = origin + totalMs * CENTER_WORDMARK_FADE_AT_RATIO
  const revealAt = origin + totalMs * REVEAL_AT_RATIO
  const flipStartAt = origin + totalMs * FLIP_START_AT_RATIO
  const handoffAt = origin + totalMs * HANDOFF_AT_RATIO
  return {
    roarAt,
    morphAt,
    backToCalmAt,
    centerWordmarkFadeAt,
    revealAt,
    flipStartAt,
    handoffAt,
    doneAt: origin + totalMs,
    totalMs,
  }
}

export function computeUniformPantherFlight(startRect: RectLike, endRect: RectLike): {
  moveX: number
  moveY: number
  scale: number
  transform: string
} {
  const startCx = startRect.left + startRect.width / 2
  const startCy = startRect.top + startRect.height / 2
  const endCx = endRect.left + endRect.width / 2
  const endCy = endRect.top + endRect.height / 2
  const moveX = endCx - startCx
  const moveY = endCy - startCy
  const scaleW = endRect.width / startRect.width
  const scaleH = endRect.height / startRect.height
  const scale = Math.max(0.12, (scaleW + scaleH) / 2)
  return {
    moveX,
    moveY,
    scale,
    transform: `translate3d(${moveX}px, ${moveY}px, 0) scale(${scale})`,
  }
}

export function isFlyerPantherVisible(phase: LaunchPhase): boolean {
  return !(phase === 'handoff' || phase === 'exiting' || phase === 'done')
}

export function isHeaderPantherVisible(handoffState?: string, playedState?: string): boolean {
  return handoffState === 'done' || playedState === '1'
}

function startLandingRevealOnce(landingStartedRef: { current: boolean }) {
  if (landingStartedRef.current) return
  landingStartedRef.current = true
  document.documentElement.dataset.coldLaunchLanding = '1'
  window.dispatchEvent(new Event('ranked-gym:cold-launch-landing'))
}

export function AppColdLaunch({ children }: { children: React.ReactNode }) {
  const reduced = useRef(typeof window !== 'undefined' ? prefersReducedMotion() : false)
  const flyerMarkRef = useRef<HTMLDivElement | null>(null)
  const flipAnimationRef = useRef<Animation | null>(null)
  const handoffTimeoutRef = useRef<number | null>(null)
  const landingStartedRef = useRef(false)
  const [phase, setPhase] = useState<LaunchPhase>(() => {
    if (typeof window === 'undefined') return 'done'
    if (document.documentElement.dataset.coldLaunchPlayed === '1') return 'done'
    return 'calm'
  })
  const [calmReady, setCalmReady] = useState(false)
  const [roarReady, setRoarReady] = useState(false)
  const [showRoar, setShowRoar] = useState(false)
  const [centerWordmarkVisible, setCenterWordmarkVisible] = useState(true)
  const [headerWordmarkVisible, setHeaderWordmarkVisible] = useState(false)
  const roarReadyRef = useRef(false)
  const phaseRef = useRef<LaunchPhase>(phase)
  phaseRef.current = phase

  useEffect(() => {
    if (phase === 'done') return
    if (phase === 'calm' || phase === 'roar' || phase === 'morphing') {
      document.documentElement.dataset.coldLaunchHandoff = 'flying'
    }
  }, [phase])

  useEffect(() => {
    document.documentElement.dataset.coldLaunchHeaderWordmark = headerWordmarkVisible ? '1' : '0'
    return () => {
      delete document.documentElement.dataset.coldLaunchHeaderWordmark
    }
  }, [headerWordmarkVisible])

  useEffect(() => {
    const signal = { cancelled: false }
    void (async () => {
      const [calmOk, roarOk] = await Promise.all([
        waitForDecoded(COLD_LAUNCH_CALM_SRC, signal),
        waitForDecoded(COLD_LAUNCH_ROAR_SRC, signal),
      ])
      if (signal.cancelled) return
      setCalmReady(calmOk)
      roarReadyRef.current = roarOk
      setRoarReady(roarOk)
    })()
    return () => {
      signal.cancelled = true
    }
  }, [])

  useEffect(() => {
    if (document.documentElement.dataset.coldLaunchPlayed === '1') {
      document.documentElement.dataset.coldLaunchHandoff = 'done'
      setPhase('done')
      return
    }

    const onPageShow = (ev: PageTransitionEvent) => {
      if (!ev.persisted) return
      document.documentElement.dataset.coldLaunchPlayed = '1'
      document.documentElement.dataset.coldLaunchHandoff = 'done'
      setPhase('done')
    }
    window.addEventListener('pageshow', onPageShow)

    if (reduced.current) {
      const t = window.setTimeout(() => {
        document.documentElement.dataset.coldLaunchPlayed = '1'
        document.documentElement.dataset.coldLaunchHandoff = 'done'
        setPhase('done')
      }, 280)
      return () => {
        window.clearTimeout(t)
        window.removeEventListener('pageshow', onPageShow)
      }
    }

    const { roarAt, morphAt, backToCalmAt, centerWordmarkFadeAt, revealAt, flipStartAt, handoffAt, doneAt } =
      coldLaunchDeadlineMs(performance.now())
    const now = performance.now()
    const roarDelay = Math.max(0, roarAt - now)
    const morphDelay = Math.max(roarDelay + 40, morphAt - now)
    const backToCalmDelay = Math.max(morphDelay + 20, backToCalmAt - now)
    const centerWordmarkFadeDelay = Math.max(morphDelay + 20, centerWordmarkFadeAt - now)
    const flipStartDelay = Math.max(morphDelay, flipStartAt - now)
    const revealDelay = Math.max(flipStartDelay + 120, revealAt - now)
    const handoffDelay = Math.max(flipStartDelay + FLIP_DURATION_MS, handoffAt - now)
    const doneDelay = Math.max(handoffDelay + 40, doneAt - now)
    const exitDelay = Math.max(handoffDelay + 10, doneDelay - 80)

    const toRoar = window.setTimeout(() => {
      if (roarReadyRef.current) {
        setShowRoar(true)
        setPhase((current) => (current === 'calm' ? 'roar' : current))
      } else {
        setPhase('calm')
      }
    }, roarDelay)
    const toMorph = window.setTimeout(() => setPhase('morphing'), morphDelay)
    const toBackToCalm = window.setTimeout(() => setShowRoar(false), backToCalmDelay)
    const toCenterWordmarkFade = window.setTimeout(() => setCenterWordmarkVisible(false), centerWordmarkFadeDelay)
    const toHeaderWordmark = window.setTimeout(() => setHeaderWordmarkVisible(true), revealDelay)
    const toReveal = window.setTimeout(
      () => startLandingRevealOnce(landingStartedRef),
      revealDelay,
    )
    const toHandoff = window.setTimeout(() => {
      document.documentElement.dataset.coldLaunchHandoff = 'done'
      setPhase((current) => (current === 'morphing' ? 'handoff' : current))
    }, handoffDelay)
    const toExit = window.setTimeout(() => setPhase('exiting'), exitDelay)
    const toDone = window.setTimeout(() => {
      document.documentElement.dataset.coldLaunchPlayed = '1'
      document.documentElement.dataset.coldLaunchHandoff = 'done'
      setPhase('done')
    }, doneDelay)

    return () => {
      window.clearTimeout(toRoar)
      window.clearTimeout(toMorph)
      window.clearTimeout(toBackToCalm)
      window.clearTimeout(toCenterWordmarkFade)
      window.clearTimeout(toHeaderWordmark)
      window.clearTimeout(toReveal)
      window.clearTimeout(toHandoff)
      window.clearTimeout(toExit)
      window.clearTimeout(toDone)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  useEffect(() => {
    if (!roarReady) return
    if (phaseRef.current !== 'calm') return
    if (reduced.current) return
    if (document.documentElement.dataset.coldLaunchPlayed === '1') return
    const { roarAt, morphAt } = coldLaunchDeadlineMs(performance.now())
    const now = performance.now()
    if (now >= roarAt && now < morphAt - 20) {
      setShowRoar(true)
      setPhase('roar')
    }
  }, [roarReady])

  useEffect(() => {
    if (phase !== 'morphing' || reduced.current) return
    if (handoffTimeoutRef.current !== null) {
      window.clearTimeout(handoffTimeoutRef.current)
      handoffTimeoutRef.current = null
    }
    const flyer = flyerMarkRef.current
    const target = document.querySelector<HTMLElement>(
      '[data-cold-launch-target="compact"] [data-brand-mark-image="compact"]',
    )
    if (!flyer || !target) return

    const startRect = flyer.getBoundingClientRect()
    const endRect = target.getBoundingClientRect()
    if (startRect.width < 1 || startRect.height < 1 || endRect.width < 1 || endRect.height < 1) return

    const flight = computeUniformPantherFlight(startRect, endRect)

    flipAnimationRef.current?.cancel()
    if (typeof flyer.animate === 'function') {
      const anim = flyer.animate(
        [
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
          { transform: flight.transform, opacity: 1 },
        ],
        {
          duration: FLIP_DURATION_MS,
          easing: 'cubic-bezier(0.23, 1, 0.32, 1)',
          fill: 'forwards',
        },
      )
      flipAnimationRef.current = anim
      handoffTimeoutRef.current = window.setTimeout(() => {
        document.documentElement.dataset.coldLaunchHandoff = 'done'
        setPhase((current) => (current === 'morphing' ? 'handoff' : current))
      }, FLIP_DURATION_MS)
      return () => {
        if (handoffTimeoutRef.current !== null) {
          window.clearTimeout(handoffTimeoutRef.current)
          handoffTimeoutRef.current = null
        }
        anim.cancel()
      }
    }

    flyer.style.transition = `transform ${FLIP_DURATION_MS}ms cubic-bezier(0.23, 1, 0.32, 1)`
    flyer.style.transform = flight.transform
    handoffTimeoutRef.current = window.setTimeout(() => {
      document.documentElement.dataset.coldLaunchHandoff = 'done'
      setPhase((current) => (current === 'morphing' ? 'handoff' : current))
    }, FLIP_DURATION_MS)
    return () => {
      if (handoffTimeoutRef.current !== null) {
        window.clearTimeout(handoffTimeoutRef.current)
        handoffTimeoutRef.current = null
      }
      flyer.style.transition = ''
    }
  }, [phase])

  const visualPhase: 'calm' | 'roar' = showRoar && roarReady ? 'roar' : 'calm'

  return (
    <>
      {children}
      {phase !== 'done' ? (
        <div
          className="app-cold-launch"
          data-phase={phase}
          data-reduced={reduced.current ? 'true' : 'false'}
          data-calm-ready={calmReady ? 'true' : 'false'}
          data-roar-ready={roarReady ? 'true' : 'false'}
          role="status"
          aria-live="polite"
          aria-label="Ranked Gym"
        >
          <div className="app-cold-launch__dimmer" aria-hidden="true" />
          <div className="app-cold-launch__safe">
            <div className="app-cold-launch__flyer" data-flight-phase={phase}>
              <div
                ref={flyerMarkRef}
                className="app-cold-launch__stack"
                data-cold-launch-panther-flyer
                data-visible={isFlyerPantherVisible(phase) ? 'true' : 'false'}
              >
                <img
                  src={COLD_LAUNCH_CALM_SRC}
                  alt=""
                  width={180}
                  height={180}
                  draggable={false}
                  decoding="async"
                  className="app-cold-launch__mark app-cold-launch__mark--calm"
                  data-active={visualPhase === 'calm' ? 'true' : 'false'}
                  onLoad={(e) => {
                    if (isDecodedImage(e.currentTarget)) setCalmReady(true)
                  }}
                />
                <img
                  src={COLD_LAUNCH_ROAR_SRC}
                  alt=""
                  width={180}
                  height={180}
                  draggable={false}
                  decoding="async"
                  className="app-cold-launch__mark app-cold-launch__mark--roar"
                  data-active={visualPhase === 'roar' ? 'true' : 'false'}
                  onLoad={(e) => {
                    if (isDecodedImage(e.currentTarget)) {
                      roarReadyRef.current = true
                      setRoarReady(true)
                    }
                  }}
                  onError={() => {
                    roarReadyRef.current = false
                    setRoarReady(false)
                  }}
                />
              </div>
              <p
                className="app-cold-launch__wordmark"
                data-visible={centerWordmarkVisible ? 'true' : 'false'}
              >
                Ranked <span>Gym</span>
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
