import { StrictMode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { AppLayout } from '../../src/components/layout/AppLayout'
import { StreakCelebrationOverlay } from '../../src/components/streak/StreakCelebrationOverlay'
import { AuthStateProvider, type StreakCelebration } from '../../src/context/AuthContext'
import { RestTimerProvider } from '../../src/context/RestTimerContext'

const celebrationPayload: StreakCelebration = {
  previousStreak: 6,
  currentStreak: 7,
  dateKey: '2026-08-30',
}

declare global {
  interface Window {
    __streakCelebrationHarness?: {
      start: () => void
      stop: () => void
      isActive: () => boolean
    }
  }
}

function StreakCard({ legacy }: { legacy: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [legacyPortalTarget, setLegacyPortalTarget] = useState<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    setLegacyPortalTarget(cardRef.current)
  }, [])

  return (
    <div
      ref={cardRef}
      className="streak-card relative h-28 overflow-hidden rounded-2xl border border-[#FF2B2B]/45 px-4 py-3.5"
      style={{
        background:
          'radial-gradient(ellipse 90% 120% at 8% 40%, rgb(255 43 43 / 0.32) 0%, transparent 55%), rgb(28 28 30 / 0.82)',
        transform: legacy ? 'translateZ(0)' : undefined,
      }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9F0A]">
        Série en cours
      </p>
      <p className="mt-0.5 text-[22px] font-black tracking-tight text-white">7 Jours de feu</p>
      {legacy && legacyPortalTarget ? (
        <StreakCelebrationOverlay
          previousStreak={celebrationPayload.previousStreak}
          currentStreak={celebrationPayload.currentStreak}
          dateKey={celebrationPayload.dateKey}
          onComplete={() => undefined}
          forceReducedMotion
          portalTarget={legacyPortalTarget}
        />
      ) : null}
    </div>
  )
}

function CaptureApp() {
  const celebrate =
    window.location.hash === '#celebration' ||
    new URLSearchParams(window.location.search).has('celebration')
  const legacy = new URLSearchParams(window.location.search).has('legacy')
  const [streakCelebration, setStreakCelebration] = useState<StreakCelebration | null>(
    celebrate ? celebrationPayload : null,
  )

  const authValue = useMemo(
    () => ({
      user: null,
      profile: { current_streak: 7, last_login_date: '2026-08-30' } as never,
      isAuthenticated: true,
      isLoading: false,
      isAuthOpen: false,
      authLoading: false,
      authError: null,
      streakWeekBonus: null,
      clearStreakWeekBonus: () => undefined,
      streakCelebration,
      clearStreakCelebration: () => setStreakCelebration(null),
      refreshProfile: async () => undefined,
      patchProfile: () => undefined,
      openAuth: () => undefined,
      closeAuth: () => undefined,
      requireAuth: () => undefined,
      signInWithEmail: async () => undefined,
      signUpWithEmail: async () => undefined,
      clearAuthMessages: () => undefined,
      requestPasswordReset: async () => undefined,
      confirmPasswordRecovery: async () => undefined,
      updateDiscipline: async () => undefined,
      updateGhostMode: async () => undefined,
      signOut: async () => undefined,
    }),
    [streakCelebration],
  )

  useEffect(() => {
    window.__streakCelebrationHarness = {
      start: () => setStreakCelebration(celebrationPayload),
      stop: () => setStreakCelebration(null),
      isActive: () => streakCelebration !== null,
    }
    return () => {
      delete window.__streakCelebrationHarness
    }
  }, [streakCelebration])

  return (
    <AuthStateProvider value={authValue}>
      <RestTimerProvider>
        <AppLayout activeTab="home" onTabChange={() => undefined}>
          <div data-harness-ready>
            <StreakCard legacy={legacy} />
            <div className="h-[140vh]" aria-hidden />
          </div>
        </AppLayout>
      </RestTimerProvider>
    </AuthStateProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CaptureApp />
  </StrictMode>,
)
