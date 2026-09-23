import { useEffect, useState, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RestTimerProvider } from './context/RestTimerContext'
import { AuthBottomSheet } from './components/auth/AuthBottomSheet'
import { WelcomeScreen } from './components/auth/WelcomeScreen'
import { AppLayout } from './components/layout/AppLayout'
import { AppBootScreen } from './components/ui/AppBootScreen'
import { BootIssueScreen, RecoverableRetryBar } from './components/ui/BootIssueScreen'
import { OfflineBanner } from './components/ui/OfflineBanner'
import { SupabaseConfigBanner } from './components/ui/SupabaseConfigBanner'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { GlobalOnboardingScreen } from './components/onboarding/GlobalOnboardingScreen'
import { SportsOnboardingScreen } from './components/onboarding/SportsOnboardingScreen'
import { HomeView } from './components/home/HomeView'
import { TrainingView } from './components/training/TrainingView'
import { NutritionView } from './components/nutrition/NutritionView'
import { ProfileView } from './components/profile/ProfileView'
import { hasCompletedNutritionOnboarding } from './services/nutritionStorage'
import type { TabId } from './types'
import { safeWarn } from './utils/safeLog'
import { getTrainingState } from './services/trainingStorage'
import { isSportsOnboardingEnabled } from './backend/trainingFeatureFlags'

type AppPhase = 'loading' | 'onboarding' | 'sports' | 'main'

function resolveLaunchPhase(): AppPhase {
  try {
    return hasCompletedNutritionOnboarding() ? 'main' : 'onboarding'
  } catch (error) {
    safeWarn('[app] resolveLaunchPhase failed, defaulting to onboarding', error)
    return 'onboarding'
  }
}

function renderActiveView(
  tab: TabId,
  onStartTraining: (routineId: string) => void,
  onOpenTraining: () => void,
  onOpenNutrition: () => void,
  launchRoutineId: string | null,
  resumeActiveWorkout: boolean,
  onLaunchConsumed: () => void,
  onAfterSession: () => void,
  openActivitySheet: boolean,
) {
  switch (tab) {
    case 'home':
      return (
        <HomeView
          onStartTraining={onStartTraining}
          onOpenTraining={onOpenTraining}
          onOpenNutrition={onOpenNutrition}
        />
      )
    case 'training':
      return (
        <TrainingView
          launchRoutineId={launchRoutineId}
          resumeActiveWorkout={resumeActiveWorkout}
          onLaunchConsumed={onLaunchConsumed}
          onGoToLobby={onAfterSession}
          openActivitySheet={openActivitySheet}
        />
      )
    case 'nutrition':
      return <NutritionView />
    case 'profile':
      return <ProfileView />
  }
}

/** Shell minimal (boot / gate). `showBrandHeader` défaut = comportement historique. */
function SessionChrome({
  showBrandHeader = true,
  children,
}: {
  showBrandHeader?: boolean
  children: ReactNode
}) {
  return (
    <div className="relative flex h-[100dvh] min-h-0 flex-col mesh-bg font-sans">
      <main className="relative z-10 mx-auto min-h-0 w-full max-w-lg flex-1 overflow-y-auto">
        {showBrandHeader ? (
          <header
            className="border-b border-white/5 bg-[#0C0C0E]"
            data-app-brand-header="1"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
              <span className="text-[17px] font-semibold tracking-tight text-white">
                Ranked <span className="text-[#FF2B2B]">Gym</span>
              </span>
            </div>
          </header>
        ) : null}
        <div
          className="px-5 py-8"
          style={
            showBrandHeader
              ? undefined
              : {
                  paddingTop: 'max(2rem, calc(env(safe-area-inset-top, 0px) + 1rem))',
                }
          }
        >
          {children}
        </div>
      </main>
    </div>
  )
}

export function AppShell() {
  const [phase, setPhase] = useState<AppPhase>('loading')
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [launchRoutineId, setLaunchRoutineId] = useState<string | null>(null)
  const [resumeActiveWorkout, setResumeActiveWorkout] = useState(false)
  const [openActivitySheet, setOpenActivitySheet] = useState(false)
  const [hasActiveWorkout, setHasActiveWorkout] = useState(() => Boolean(getTrainingState().activeWorkoutDraft))
  const { openAuth, isAuthenticated, isLoading, bootIssue, retryHydrate } = useAuth()
  const online = useOnlineStatus()

  useEffect(() => {
    if (isLoading) {
      setPhase('loading')
      return
    }

    if (!isAuthenticated) {
      setPhase('loading')
      return
    }

    setPhase(resolveLaunchPhase())
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    const syncOnboardingPhase = () => {
      try {
        if (hasCompletedNutritionOnboarding()) {
          setPhase((current) => (current === 'onboarding' ? 'main' : current))
        }
      } catch (error) {
        safeWarn('[app] syncOnboardingPhase failed', error)
        setPhase('onboarding')
      }
    }

    window.addEventListener('ranked-gym:profile-changed', syncOnboardingPhase)
    window.addEventListener('ranked-gym:backup-restored', syncOnboardingPhase)
    return () => {
      window.removeEventListener('ranked-gym:profile-changed', syncOnboardingPhase)
      window.removeEventListener('ranked-gym:backup-restored', syncOnboardingPhase)
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setActiveTab('home')
      setLaunchRoutineId(null)
      setResumeActiveWorkout(false)
    }
  }, [isAuthenticated])

  useEffect(() => {
    const syncActiveWorkout = () => setHasActiveWorkout(Boolean(getTrainingState().activeWorkoutDraft))
    window.addEventListener('ranked-gym:training-changed', syncActiveWorkout)
    window.addEventListener('focus', syncActiveWorkout)
    return () => {
      window.removeEventListener('ranked-gym:training-changed', syncActiveWorkout)
      window.removeEventListener('focus', syncActiveWorkout)
    }
  }, [])

  const handleTabChange = (tab: TabId) => {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    setActiveTab(tab)
  }

  const handleStartTraining = (routineId: string) => {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    setLaunchRoutineId(routineId)
    setResumeActiveWorkout(false)
    setActiveTab('training')
  }

  const handleOpenTraining = () => {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    setLaunchRoutineId(null)
    setResumeActiveWorkout(false)
    setActiveTab('training')
  }

  const handleStartFromNav = () => {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    const activeDraft = getTrainingState().activeWorkoutDraft
    if (activeDraft) {
      setLaunchRoutineId(activeDraft.routineId)
      setResumeActiveWorkout(true)
      setOpenActivitySheet(false)
      setActiveTab('training')
      return
    }
    setLaunchRoutineId(null)
    setResumeActiveWorkout(false)
    setOpenActivitySheet(true)
    setActiveTab('training')
  }

  const handleOpenNutrition = () => {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    setActiveTab('nutrition')
  }

  const handleLaunchConsumed = () => {
    setLaunchRoutineId(null)
    setResumeActiveWorkout(false)
    setOpenActivitySheet(false)
  }

  const handleOnboardingComplete = () => {
    if (
      isSportsOnboardingEnabled() &&
      getTrainingState().sportsOnboardingComplete !== true
    ) {
      setPhase('sports')
      return
    }
    setPhase('main')
    setActiveTab('home')
  }

  const handleSportsComplete = () => {
    setPhase('main')
    setActiveTab('home')
  }

  if (isLoading) {
    return (
      <>
        <SupabaseConfigBanner />
        {!online ? <OfflineBanner /> : null}
        <SessionChrome showBrandHeader={false}>
          <AppBootScreen />
        </SessionChrome>
        <AuthBottomSheet />
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <SupabaseConfigBanner />
        {!online ? <OfflineBanner /> : null}
        <WelcomeScreen onConnect={() => openAuth()} />
        <AuthBottomSheet />
      </>
    )
  }

  if (bootIssue === 'blocking') {
    return (
      <>
        <SupabaseConfigBanner />
        {!online ? <OfflineBanner /> : null}
        <SessionChrome showBrandHeader={false}>
          <BootIssueScreen kind="blocking" onRetry={() => void retryHydrate()} />
        </SessionChrome>
        <AuthBottomSheet />
      </>
    )
  }

  if (phase === 'onboarding') {
    return (
      <>
        <SupabaseConfigBanner />
        {!online ? <OfflineBanner /> : null}
        <GlobalOnboardingScreen onComplete={handleOnboardingComplete} />
        <AuthBottomSheet />
      </>
    )
  }

  if (phase === 'sports') {
    return (
      <>
        <SupabaseConfigBanner />
        {!online ? <OfflineBanner /> : null}
        <SportsOnboardingScreen onComplete={handleSportsComplete} />
        <AuthBottomSheet />
      </>
    )
  }

  return (
    <>
      <SupabaseConfigBanner />
      {!online ? <OfflineBanner /> : null}
      <AppLayout
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onStartTraining={handleStartFromNav}
        hasActiveWorkout={hasActiveWorkout}
      >
        {bootIssue === 'recoverable' ? (
          <RecoverableRetryBar onRetry={() => void retryHydrate()} />
        ) : null}
        {renderActiveView(
          activeTab,
          handleStartTraining,
          handleOpenTraining,
          handleOpenNutrition,
          launchRoutineId,
          resumeActiveWorkout,
          handleLaunchConsumed,
          () => setActiveTab('home'),
          openActivitySheet,
        )}
      </AppLayout>
      <AuthBottomSheet />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <RestTimerProvider>
        <AppShell />
      </RestTimerProvider>
    </AuthProvider>
  )
}
