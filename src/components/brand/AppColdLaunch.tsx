import { useEffect, useRef, useState } from 'react'

/** Logo splash — même PNG que le boot `index.html` (pas de nouvel asset). */
export const COLD_LAUNCH_LOGO_SRC = '/brand-splash-calm.png'
/** @deprecated alias — préférer `COLD_LAUNCH_LOGO_SRC` */
export const COLD_LAUNCH_CALM_SRC = COLD_LAUNCH_LOGO_SRC

/** Durée totale Shockwave (~1 s) puis fondu / retrait. */
export const COLD_LAUNCH_TOTAL_MS = 1000
/** Reduced-motion : fade bref, sans onde ni scale. */
export const COLD_LAUNCH_REDUCED_MS = 280
/** Début du fondu + révélation Accueil. */
export const COLD_LAUNCH_EXIT_AT_MS = 720
/** Landing UI (nav / Accueil) juste avant la fin du fondu. */
export const COLD_LAUNCH_LANDING_AT_MS = 700

type LaunchPhase = 'playing' | 'exiting' | 'done'

/** Garde module : un seul play par chargement document (pas de replay navigation). */
let coldLaunchConsumed = false

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

export function hasColdLaunchPlayed(): boolean {
  if (coldLaunchConsumed) return true
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.coldLaunchPlayed === '1'
}

export function markColdLaunchPlayed(): void {
  coldLaunchConsumed = true
  if (typeof document === 'undefined') return
  document.documentElement.dataset.coldLaunchPlayed = '1'
  document.documentElement.dataset.coldLaunchHandoff = 'done'
}

/** Test-only : réinitialise la garde module entre cas. */
export function resetColdLaunchGuardForTests(): void {
  coldLaunchConsumed = false
}

function startLandingRevealOnce(landingStartedRef: { current: boolean }) {
  if (landingStartedRef.current) return
  landingStartedRef.current = true
  document.documentElement.dataset.coldLaunchLanding = '1'
  document.documentElement.dataset.coldLaunchHandoff = 'done'
  window.dispatchEvent(new Event('ranked-gym:cold-launch-landing'))
}

/**
 * Lancement froid Shockwave — logo centré + onde d’impact (CSS only).
 * Joue une seule fois au premier mount ; skip au tap ; reduced-motion = fade court.
 */
export function AppColdLaunch({ children }: { children: React.ReactNode }) {
  const reduced = useRef(typeof window !== 'undefined' ? prefersReducedMotion() : false)
  const landingStartedRef = useRef(false)
  const finishedRef = useRef(false)
  const [phase, setPhase] = useState<LaunchPhase>(() => {
    if (typeof window === 'undefined') return 'done'
    if (hasColdLaunchPlayed()) return 'done'
    return 'playing'
  })

  const finish = (immediate = false) => {
    if (finishedRef.current) return
    finishedRef.current = true
    startLandingRevealOnce(landingStartedRef)
    markColdLaunchPlayed()
    if (immediate) {
      setPhase('done')
      return
    }
    setPhase('exiting')
  }

  useEffect(() => {
    if (phase === 'done') return
    document.documentElement.dataset.coldLaunchHandoff = 'flying'
  }, [phase])

  useEffect(() => {
    if (hasColdLaunchPlayed()) {
      markColdLaunchPlayed()
      setPhase('done')
      return
    }

    const onPageShow = (ev: PageTransitionEvent) => {
      if (!ev.persisted) return
      markColdLaunchPlayed()
      setPhase('done')
    }
    window.addEventListener('pageshow', onPageShow)

    if (reduced.current) {
      const t = window.setTimeout(() => {
        if (finishedRef.current) return
        finishedRef.current = true
        startLandingRevealOnce(landingStartedRef)
        markColdLaunchPlayed()
        setPhase('done')
      }, COLD_LAUNCH_REDUCED_MS)
      return () => {
        window.clearTimeout(t)
        window.removeEventListener('pageshow', onPageShow)
      }
    }

    const toLanding = window.setTimeout(() => {
      startLandingRevealOnce(landingStartedRef)
    }, COLD_LAUNCH_LANDING_AT_MS)
    const toExit = window.setTimeout(() => {
      setPhase((current) => (current === 'playing' ? 'exiting' : current))
    }, COLD_LAUNCH_EXIT_AT_MS)
    const toDone = window.setTimeout(() => {
      if (finishedRef.current) return
      finishedRef.current = true
      startLandingRevealOnce(landingStartedRef)
      markColdLaunchPlayed()
      setPhase('done')
    }, COLD_LAUNCH_TOTAL_MS)

    return () => {
      window.clearTimeout(toLanding)
      window.clearTimeout(toExit)
      window.clearTimeout(toDone)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  const onSkip = () => {
    if (phase === 'done') return
    finish(true)
  }

  return (
    <>
      {children}
      {phase !== 'done' ? (
        <div
          className="app-cold-launch"
          data-phase={phase}
          data-shockwave="1"
          data-reduced={reduced.current ? 'true' : 'false'}
          role="status"
          aria-live="polite"
          aria-label="Ranked Gym"
          onPointerDown={onSkip}
          onClick={onSkip}
        >
          <div className="app-cold-launch__dimmer" aria-hidden="true" />
          <div className="app-cold-launch__safe">
            <div className="app-cold-launch__stage" aria-hidden="true">
              {!reduced.current ? (
                <>
                  <span className="app-cold-launch__flash" />
                  <span className="app-cold-launch__ring app-cold-launch__ring--1" />
                  <span className="app-cold-launch__ring app-cold-launch__ring--2" />
                  <span className="app-cold-launch__ring app-cold-launch__ring--3" />
                </>
              ) : null}
              <img
                src={COLD_LAUNCH_LOGO_SRC}
                alt=""
                width={180}
                height={180}
                draggable={false}
                decoding="async"
                className="app-cold-launch__mark"
              />
            </div>
            <p className="app-cold-launch__wordmark">
              Ranked <span>Gym</span>
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
