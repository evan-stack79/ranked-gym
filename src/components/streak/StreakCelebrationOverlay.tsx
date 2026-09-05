import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import pantherRoaringUrl from '../../assets/brand/panther-roaring.png'
import {
  formatStreakDaysLabel,
  getStreakStatusMessage,
  getWeekStripDays,
  isStreakMilestone,
} from '../../services/streakService'

export type StreakCelebrationOverlayProps = {
  previousStreak: number
  currentStreak: number
  dateKey: string
  onComplete: () => void
  /** Test / preview only — force reduced-motion path. */
  forceReducedMotion?: boolean
  /** Capture avant uniquement : reproduit l'ancien montage local dans la carte. */
  portalTarget?: Element
}

export type StreakCelebrationPhase =
  | 'idle'
  | 'compress'
  | 'launch'
  | 'burst'
  | 'count'
  | 'reveal'
  | 'week'
  | 'settled'

/** Timings exacts de la chorégraphie (~5,7 s). */
export const STREAK_CELEB_PHASE_STEPS: Array<{ at: number; phase: StreakCelebrationPhase }> = [
  { at: 0, phase: 'idle' },
  { at: 550, phase: 'compress' },
  { at: 850, phase: 'launch' },
  { at: 1000, phase: 'burst' },
  { at: 1350, phase: 'count' },
  { at: 1700, phase: 'reveal' },
  { at: 2300, phase: 'week' },
  { at: 3800, phase: 'settled' },
]

export const STREAK_CELEB_TOTAL_MS = 5700
/** Skip vers l’état final autorisé après le début de la révélation. */
export const STREAK_CELEB_SKIP_AFTER_MS = 1700
export const STREAK_CELEB_REDUCED_MS = 900

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function FlameGlyph({ lit, className = '' }: { lit: boolean; className?: string }) {
  if (!lit) {
    return (
      <svg className={className} viewBox="0 0 64 80" aria-hidden>
        <path
          d="M32 4c6 14-4 22-4 34 0 8 6 14 14 14 12 0 18-12 14-26 10 12 14 22 14 32 0 18-14 30-30 30S10 76 10 58C10 40 22 26 32 4z"
          fill="#3A3A3C"
        />
      </svg>
    )
  }

  return (
    <svg className={className} viewBox="0 0 64 80" aria-hidden>
      <defs>
        <linearGradient id="rgStreakFlameOuter" x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#B91C1C" />
          <stop offset="45%" stopColor="#FF2B2B" />
          <stop offset="75%" stopColor="#FF7A1A" />
          <stop offset="100%" stopColor="#FFC928" />
        </linearGradient>
        <linearGradient id="rgStreakFlameInner" x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0%" stopColor="#FF7A1A" />
          <stop offset="60%" stopColor="#FFC928" />
          <stop offset="100%" stopColor="#FFF4C2" />
        </linearGradient>
      </defs>
      <path
        d="M32 4c6 14-4 22-4 34 0 8 6 14 14 14 12 0 18-12 14-26 10 12 14 22 14 32 0 18-14 30-30 30S10 76 10 58C10 40 22 26 32 4z"
        fill="url(#rgStreakFlameOuter)"
      />
      <path
        d="M32 28c3 8-1 12-1 18 0 5 3 8 8 8 6 0 9-6 7-14 5 6 7 12 7 18 0 10-8 17-17 17s-15-7-15-17c0-10 6-18 11-30z"
        fill="url(#rgStreakFlameInner)"
        opacity="0.95"
      />
    </svg>
  )
}

/**
 * Célébration Daily Streak — chorégraphie ~5,7 s (CSS/SVG, pas de vidéo).
 * À monter uniquement après une vraie incrémentation N → N+1.
 */
export const StreakCelebrationOverlay = forwardRef<
  HTMLDivElement,
  StreakCelebrationOverlayProps
>(function StreakCelebrationOverlay(
  {
    previousStreak,
    currentStreak,
    dateKey,
    onComplete,
    forceReducedMotion,
    portalTarget,
  },
  forwardedRef,
) {
  const reduced = useMemo(
    () => forceReducedMotion === true || prefersReducedMotion(),
    [forceReducedMotion],
  )
  const [phase, setPhase] = useState<StreakCelebrationPhase>(reduced ? 'settled' : 'idle')
  const [displayCount, setDisplayCount] = useState(previousStreak)
  const [showNewCount, setShowNewCount] = useState(reduced)
  const [flash, setFlash] = useState(false)
  const [todayFlame, setTodayFlame] = useState(reduced)
  const completedRef = useRef(false)
  const startedAtRef = useRef(0)
  const timersRef = useRef<number[]>([])
  const overlayRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(forwardedRef, () => overlayRef.current as HTMLDivElement)

  const milestone = isStreakMilestone(currentStreak)
  const weekDays = useMemo(() => getWeekStripDays(currentStreak), [currentStreak])
  const statusMessage = useMemo(
    () => getStreakStatusMessage(currentStreak),
    [currentStreak],
  )
  const daysLabel = useMemo(
    () => formatStreakDaysLabel(currentStreak),
    [currentStreak],
  )
  const coveredRatio = useMemo(() => {
    const covered = weekDays.filter((day) => day.isCovered).length
    return Math.min(100, (covered / 7) * 100)
  }, [weekDays])

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onComplete()
  }, [onComplete])

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) window.clearTimeout(id)
    timersRef.current = []
  }, [])

  const schedule = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timersRef.current.push(id)
  }, [])

  useEffect(() => {
    return () => {
      clearTimers()
    }
  }, [clearTimers])

  useEffect(() => {
    startedAtRef.current =
      typeof performance !== 'undefined' ? performance.now() : Date.now()

    if (reduced) {
      setDisplayCount(currentStreak)
      setShowNewCount(true)
      setTodayFlame(true)
      setPhase('settled')
      schedule(finish, STREAK_CELEB_REDUCED_MS)
      return () => clearTimers()
    }

    for (const step of STREAK_CELEB_PHASE_STEPS) {
      schedule(() => setPhase(step.phase), step.at)
    }

    schedule(() => {
      setFlash(true)
      schedule(() => setFlash(false), 180)
    }, 1000)

    // Ancien nombre encore visible, puis roulement → nouveau.
    schedule(() => {
      setShowNewCount(true)
      setDisplayCount(currentStreak)
    }, 1500)

    // Marqueur gris → petite flamme (3 400–3 800 ms).
    schedule(() => setTodayFlame(true), 3400)

    schedule(finish, STREAK_CELEB_TOTAL_MS)

    return () => clearTimers()
  }, [clearTimers, currentStreak, finish, reduced, schedule])

  const jumpToSettledThenClose = useCallback(() => {
    clearTimers()
    setFlash(false)
    setShowNewCount(true)
    setDisplayCount(currentStreak)
    setTodayFlame(true)
    setPhase('settled')
    schedule(finish, 700)
  }, [clearTimers, currentStreak, finish, schedule])

  const onSkip = () => {
    if (completedRef.current) return
    if (reduced) {
      finish()
      return
    }
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    if (now - startedAtRef.current < STREAK_CELEB_SKIP_AFTER_MS) return
    jumpToSettledThenClose()
  }

  // Flamme dorée allumée à partir de la révélation (ou dès le nouveau compte).
  const lit =
    reduced ||
    showNewCount ||
    phase === 'reveal' ||
    phase === 'week' ||
    phase === 'settled'
  const showWeek = phase === 'week' || phase === 'settled'
  const showReveal = phase === 'reveal' || phase === 'week' || phase === 'settled'
  const showBurst =
    phase === 'burst' || phase === 'count' || phase === 'reveal' || phase === 'week'
  const showPanther =
    milestone &&
    (phase === 'burst' ||
      phase === 'count' ||
      phase === 'reveal' ||
      phase === 'week' ||
      phase === 'settled')

  const overlay = (
    <div
      ref={overlayRef}
      className={`streak-celeb streak-celeb--${phase}${reduced ? ' streak-celeb--reduced' : ''}${
        showNewCount ? ' streak-celeb--lit' : ''
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`Nouvelle série de ${currentStreak} jour${currentStreak > 1 ? 's' : ''}`}
      data-date-key={dateKey}
      data-previous-streak={previousStreak}
      data-current-streak={currentStreak}
      onClick={onSkip}
      onKeyDown={(event) => {
        if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSkip()
        }
      }}
      tabIndex={0}
    >
      <span className="sr-only">
        Nouvelle série de {currentStreak} jour{currentStreak > 1 ? 's' : ''}
      </span>

      {flash ? <div className="streak-celeb__flash" aria-hidden /> : null}

      <div className="streak-celeb__halo" aria-hidden />

      {showBurst ? (
        <div className="streak-celeb__burst" aria-hidden>
          <span className="streak-celeb__ring" />
          <span className="streak-celeb__star" />
          {Array.from({ length: 8 }, (_, index) => (
            <span
              key={index}
              className={`streak-celeb__particle streak-celeb__particle--${index}`}
            />
          ))}
        </div>
      ) : null}

      {showPanther ? (
        <div
          className={`streak-celeb__panther${
            phase === 'settled' || phase === 'week' ? ' streak-celeb__panther--badge' : ''
          }`}
          aria-hidden
        >
          <img src={pantherRoaringUrl} alt="" draggable={false} />
          <span className="streak-celeb__crown" />
        </div>
      ) : null}

      <div className="streak-celeb__stage">
        <div className="streak-celeb__shadow" aria-hidden />
        <div className="streak-celeb__flame-wrap">
          <FlameGlyph lit={lit} className="streak-celeb__flame" />
        </div>

        <div
          className={`streak-celeb__count${
            showNewCount ? ' streak-celeb__count--new' : ' streak-celeb__count--old'
          }`}
          aria-hidden
        >
          {displayCount}
        </div>

        {showReveal ? <p className="streak-celeb__label">{daysLabel}</p> : null}
        {showReveal ? <p className="streak-celeb__message">{statusMessage}</p> : null}
      </div>

      {showWeek ? (
        <div
          className="streak-celeb__week"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="streak-celeb__week-days">
            {weekDays.map((day) => (
              <div
                key={`${day.label}-${day.weekdayIndex}`}
                className={`streak-celeb__day${day.isToday ? ' is-today' : ''}${
                  day.isCovered ? ' is-covered' : ''
                }`}
              >
                <span className="streak-celeb__day-label">{day.label}</span>
                <span
                  className={`streak-celeb__day-dot${
                    day.isToday && !todayFlame ? ' is-pending' : ''
                  }${day.isToday && todayFlame ? ' is-lit' : ''}`}
                >
                  {day.isCovered && day.isToday && todayFlame ? (
                    <FlameGlyph lit className="streak-celeb__day-flame" />
                  ) : null}
                </span>
              </div>
            ))}
          </div>
          <div className="streak-celeb__week-bar" aria-hidden>
            <div
              className="streak-celeb__week-fill"
              style={{ ['--streak-week-fill' as string]: `${coveredRatio}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )

  if (typeof document === 'undefined') return null

  return createPortal(overlay, portalTarget ?? document.body)
})
