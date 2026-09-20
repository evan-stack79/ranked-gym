import {
  Component,
  useCallback,
  useLayoutEffect,
  useRef,
  type ErrorInfo,
  type ReactNode,
  type RefObject,
} from 'react'
import { useAuth, type StreakCelebration } from '../../context/AuthContext'
import { captureFocusReturnTarget } from '../../utils/streakCelebrationFocus'
import {
  enterStreakCelebrationSession,
  scheduleStreakCelebrationSessionUnmount,
  syncStreakCelebrationSessionRefs,
} from '../../utils/streakCelebrationSession'
import { safeWarn } from '../../utils/safeLog'
import { StreakCelebrationOverlay } from './StreakCelebrationOverlay'

type StreakCelebrationHostProps = {
  shellRef: RefObject<HTMLDivElement | null>
}

type SessionProps = {
  celebration: StreakCelebration
  onFinalize: () => void
}

type ErrorBoundaryProps = {
  children: ReactNode
  onFinalize: () => void
}

type ErrorBoundaryState = {
  hasError: boolean
}

class StreakCelebrationErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    safeWarn('[streak-celeb] overlay error', { error, componentStack: info.componentStack })
    this.props.onFinalize()
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

function StreakCelebrationSession({ celebration, onFinalize }: SessionProps) {
  const finalizedRef = useRef(false)
  // Évalué pendant le render, avant que le commit ne pose `inert` sur AppLayout.
  const focusReturnRef = useRef<HTMLElement | null>(captureFocusReturnTarget())
  const overlayRef = useRef<HTMLDivElement>(null)

  const finalize = useCallback(() => {
    if (finalizedRef.current) return
    finalizedRef.current = true
    onFinalize()
  }, [onFinalize])

  useLayoutEffect(() => {
    finalizedRef.current = false
    const generation = enterStreakCelebrationSession(null, focusReturnRef.current)

    return () => {
      scheduleStreakCelebrationSessionUnmount(generation)
    }
  }, [])

  useLayoutEffect(() => {
    syncStreakCelebrationSessionRefs(overlayRef.current, focusReturnRef.current)
  })

  return (
    <StreakCelebrationOverlay
      ref={overlayRef}
      previousStreak={celebration.previousStreak}
      currentStreak={celebration.currentStreak}
      dateKey={celebration.dateKey}
      onComplete={finalize}
    />
  )
}

/**
 * Hôte persistant — monte la célébration Daily Streak au niveau AppLayout
 * (portal body, finalizer idempotent, boundary locale).
 */
/** @internal — shellRef conservé pour compat AppLayout (inert déclaratif sur le shell). */
export function StreakCelebrationHost({ shellRef: _shellRef }: StreakCelebrationHostProps) {
  const { streakCelebration, clearStreakCelebration } = useAuth()

  const handleFinalize = useCallback(() => {
    clearStreakCelebration()
  }, [clearStreakCelebration])

  if (!streakCelebration) return null

  return (
    <StreakCelebrationErrorBoundary onFinalize={handleFinalize}>
      <StreakCelebrationSession
        key={`${streakCelebration.dateKey}-${streakCelebration.currentStreak}`}
        celebration={streakCelebration}
        onFinalize={handleFinalize}
      />
    </StreakCelebrationErrorBoundary>
  )
}
