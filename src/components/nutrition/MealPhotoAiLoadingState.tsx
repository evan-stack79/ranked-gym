import { useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  flattenMealPhotoAiSteps,
  MEAL_PHOTO_AI_LINE_HEIGHT_PX,
  MEAL_PHOTO_AI_TICK_MS,
  MEAL_PHOTO_AI_VISIBLE_LINES,
  resolveMealPhotoAiStep,
} from './mealPhotoAiLoading'

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function MealPhotoAiSpinner({ progress }: { progress: number }) {
  const reactId = useId().replace(/:/g, '')
  const maskId = `meal-ai-progress-${reactId}`
  const rounded = Number.isFinite(progress) ? Math.round(Math.max(0, Math.min(progress, 100))) : 0
  const circumference = 754
  const dash = (rounded / 100) * circumference

  return (
    <div className="meal-photo-ai-spinner" aria-hidden>
      <svg
        className="meal-photo-ai-spinner__svg"
        fill="none"
        viewBox="0 0 240 240"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <mask id={maskId}>
            <rect fill="black" height="240" width="240" />
            <circle
              cx="120"
              cy="120"
              fill="white"
              r="120"
              strokeDasharray={`${dash}, ${circumference}`}
              transform="rotate(-90 120 120)"
            />
          </mask>
        </defs>
        <g className="meal-photo-ai-spinner__rings" mask={`url(#${maskId})`}>
          <circle cx="120" cy="120" opacity="0.95" r="150" stroke="#FF2B2B" />
          <circle cx="120" cy="120" opacity="0.95" r="130" stroke="#BF5AF2" />
          <circle cx="120" cy="120" opacity="0.95" r="110" stroke="#30D158" />
          <circle cx="120" cy="120" opacity="0.95" r="90" stroke="#FF9F0A" />
          <circle cx="120" cy="120" opacity="0.95" r="70" stroke="#64D2FF" />
          <circle cx="120" cy="120" opacity="0.95" r="50" stroke="#FF375F" />
        </g>
      </svg>
    </div>
  )
}

export type MealPhotoAiLoadingStateProps = {
  previewUrl?: string | null
  /** Tests : forcer reduced-motion sans matcher. */
  forceReducedMotion?: boolean
}

export function MealPhotoAiLoadingState({
  previewUrl = null,
  forceReducedMotion = false,
}: MealPhotoAiLoadingStateProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [cursor, setCursor] = useState(0)
  const motionReduce = useReducedMotion()
  const reduceMotion = forceReducedMotion || prefersReducedMotion() || Boolean(motionReduce)
  const { step, progress, index } = resolveMealPhotoAiStep(cursor)
  const statusLabel = `${step.status}…`
  const allSteps = flattenMealPhotoAiSteps()
  const trackOffset = Math.max(0, index - (MEAL_PHOTO_AI_VISIBLE_LINES - 1)) * MEAL_PHOTO_AI_LINE_HEIGHT_PX
  const easeOut = [0.23, 1, 0.32, 1] as const

  useEffect(() => {
    const element = rootRef.current
    if (!element || typeof IntersectionObserver === 'undefined') {
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry?.isIntersecting ?? true),
      { rootMargin: '100px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || reduceMotion) return
    const timer = window.setInterval(() => {
      setCursor((current) => current + 1)
    }, MEAL_PHOTO_AI_TICK_MS)
    return () => window.clearInterval(timer)
  }, [isVisible, reduceMotion])

  return (
    <div className="meal-photo-ai-loading" ref={rootRef}>
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          className="meal-photo-ai-loading__preview"
        />
      ) : null}

      <div className="meal-photo-ai-loading__status">
        <MealPhotoAiSpinner progress={progress} />
        <div className="meal-photo-ai-loading__status-slot">
          <AnimatePresence initial={false}>
            <motion.p
              key={statusLabel}
              className="meal-photo-ai-loading__status-text"
              aria-live="polite"
              initial={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: 'translateY(8px)' }
              }
              animate={{ opacity: 1, transform: 'translateY(0px)' }}
              exit={
                reduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, transform: 'translateY(-8px)' }
              }
              transition={{ duration: 0.22, ease: easeOut }}
            >
              {statusLabel}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>

      <div className="meal-photo-ai-loading__log" aria-hidden={reduceMotion}>
        <div
          className="meal-photo-ai-loading__log-window"
          style={{ height: MEAL_PHOTO_AI_VISIBLE_LINES * MEAL_PHOTO_AI_LINE_HEIGHT_PX }}
        >
          <div
            className="meal-photo-ai-loading__log-track"
            style={{
              transform: `translateY(-${reduceMotion ? 0 : trackOffset}px)`,
            }}
          >
            {allSteps.map((line, stepIndex) => (
              <div
                className={
                  stepIndex === index
                    ? 'meal-photo-ai-loading__log-line is-current'
                    : 'meal-photo-ai-loading__log-line'
                }
                key={`${stepIndex}-${line.text}`}
              >
                <span className="meal-photo-ai-loading__log-num">{line.number}</span>
                <span className="meal-photo-ai-loading__log-text">{line.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="meal-photo-ai-loading__log-fade" />
      </div>

      <p className="meal-photo-ai-loading__hint">
        L’IA estime calories, protéines, glucides et lipides. Rien n’est enregistré tant que
        l’analyse n’est pas terminée.
      </p>
    </div>
  )
}

