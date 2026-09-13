import { useEffect, useRef, useState } from 'react'

/** URLs publiques préchargées dans index.html — affichées telles quelles. */
export const COLD_LAUNCH_CALM_SRC = '/brand-splash-calm.png'
export const COLD_LAUNCH_ROAR_SRC = '/brand-splash-roar.png'

/** Cible totale depuis le début réel du document. */
export const COLD_LAUNCH_MIN_MS = 800
export const COLD_LAUNCH_MAX_MS = 1200
/** @deprecated alias — total cible nominal */
export const COLD_LAUNCH_TOTAL_MS = 900

type LaunchPhase = 'calm' | 'roar' | 'exiting' | 'done'

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

/** Début document : marque index.html, sinon timeOrigin / now. */
export function documentBootOriginMs(): number {
  if (typeof window === 'undefined') return 0
  if (typeof window.__RG_BOOT_T0__ === 'number' && Number.isFinite(window.__RG_BOOT_T0__)) {
    return window.__RG_BOOT_T0__
  }
  if (typeof performance !== 'undefined' && Number.isFinite(performance.timeOrigin)) {
    return 0 // performance.now() est déjà relatif à timeOrigin
  }
  return 0
}

export function coldLaunchDeadlineMs(now = performance.now()): {
  roarAt: number
  exitAt: number
  doneAt: number
  totalMs: number
} {
  const origin = documentBootOriginMs()
  // Idéal ~0,9 s depuis le document ; clamp [0,8 ; 1,2] ; ne bloque pas un boot déjà long.
  const idealDone = origin + COLD_LAUNCH_TOTAL_MS
  const minDone = origin + COLD_LAUNCH_MIN_MS
  const maxDone = origin + COLD_LAUNCH_MAX_MS
  const earliestExit = now + 120
  const doneAt = Math.min(maxDone, Math.max(minDone, Math.max(earliestExit, idealDone)))
  const totalMs = Math.max(120, doneAt - origin)
  const roarAt = origin + totalMs * (420 / 900)
  const exitAt = Math.max(roarAt + 40, origin + totalMs - 180)
  return { roarAt, exitAt, doneAt: origin + totalMs, totalMs }
}

/**
 * Lancement froid premium : calme → rugissant, une seule fois par document.
 * Pas de replay au retour d’arrière-plan (visibilitychange / pageshow bfcache).
 * Affiche les assets préchargés ; roar seulement si décodé ; calm en cas d’échec / lenteur.
 */
export function AppColdLaunch({ children }: { children: React.ReactNode }) {
  const reduced = useRef(typeof window !== 'undefined' ? prefersReducedMotion() : false)
  const [phase, setPhase] = useState<LaunchPhase>(() => {
    if (typeof window === 'undefined') return 'done'
    if (document.documentElement.dataset.coldLaunchPlayed === '1') return 'done'
    return 'calm'
  })
  const [calmReady, setCalmReady] = useState(false)
  const [roarReady, setRoarReady] = useState(false)
  const [hadRoar, setHadRoar] = useState(false)
  const roarReadyRef = useRef(false)
  const phaseRef = useRef<LaunchPhase>(phase)
  phaseRef.current = phase

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
      setPhase('done')
      return
    }

    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) {
        document.documentElement.dataset.coldLaunchPlayed = '1'
        setPhase('done')
      }
    }
    window.addEventListener('pageshow', onPageShow)

    if (reduced.current) {
      // Accessibility path intentionally bypasses the 0.8–1.2s delight budget.
      const toExit = window.setTimeout(() => {
        setPhase('exiting')
      }, 170)
      const t = window.setTimeout(() => {
        document.documentElement.dataset.coldLaunchPlayed = '1'
        document.documentElement.dataset.coldLaunchLanding = '1'
        setPhase('done')
      }, 280)
      return () => {
        window.clearTimeout(toExit)
        window.clearTimeout(t)
        window.removeEventListener('pageshow', onPageShow)
      }
    }

    const { roarAt, exitAt, doneAt } = coldLaunchDeadlineMs(performance.now())
    const now = performance.now()
    const roarDelay = Math.max(0, roarAt - now)
    const exitDelay = Math.max(roarDelay + 40, exitAt - now)
    const doneDelay = Math.max(exitDelay + 60, doneAt - now)

    // Passe en roar seulement si décodé ; sinon reste calm jusqu’à la borne (pas de délai artificiel).
    const toRoar = window.setTimeout(() => {
      if (roarReadyRef.current) {
        setHadRoar(true)
        setPhase('roar')
      } else setPhase('calm')
    }, roarDelay)
    const toExit = window.setTimeout(() => {
      setPhase('exiting')
    }, exitDelay)
    const toDone = window.setTimeout(() => {
      document.documentElement.dataset.coldLaunchPlayed = '1'
      document.documentElement.dataset.coldLaunchLanding = '1'
      setPhase('done')
    }, doneDelay)

    return () => {
      window.clearTimeout(toRoar)
      window.clearTimeout(toExit)
      window.clearTimeout(toDone)
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [])

  // Si roar devient prêt pendant la fenêtre calm→roar prévue, bascule sans dépasser done.
  useEffect(() => {
    if (!roarReady) return
    if (phaseRef.current !== 'calm') return
    if (reduced.current) return
    if (document.documentElement.dataset.coldLaunchPlayed === '1') return
    const { roarAt, exitAt } = coldLaunchDeadlineMs(performance.now())
    const now = performance.now()
    if (now >= roarAt && now < exitAt - 20) {
      setHadRoar(true)
      setPhase('roar')
    }
  }, [roarReady])

  const showRoar = (phase === 'roar' || (phase === 'exiting' && hadRoar)) && roarReady
  const visualPhase: LaunchPhase = phase === 'done' ? 'done' : showRoar ? 'roar' : 'calm'

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
          <div className="app-cold-launch__safe">
            <div className="app-cold-launch__stack">
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
            <p className="app-cold-launch__wordmark">
              Ranked <span>Gym</span>
            </p>
          </div>
        </div>
      ) : null}
    </>
  )
}
