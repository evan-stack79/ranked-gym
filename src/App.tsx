import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RestTimerProvider } from './context/RestTimerContext'
import { AuthBottomSheet } from './components/auth/AuthBottomSheet'
import { WelcomeScreen } from './components/auth/WelcomeScreen'
import { AppLayout } from './components/layout/AppLayout'
import { AppBootScreen } from './components/ui/AppBootScreen'
import { GlobalOnboardingScreen } from './components/onboarding/GlobalOnboardingScreen'
import { HomeView } from './components/home/HomeView'
import { TrainingView } from './components/training/TrainingView'
import { NutritionView } from './components/nutrition/NutritionView'
import { ProfileView } from './components/profile/ProfileView'
import { hasCompletedNutritionOnboarding } from './services/nutritionStorage'
import type { TabId } from './types'
import { safeWarn } from './utils/safeLog'

type AppPhase = 'loading' | 'onboarding' | 'main'

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
  onLaunchConsumed: () => void,
  onAfterSession: () => void,
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
          onLaunchConsumed={onLaunchConsumed}
          onGoToLobby={onAfterSession}
        />
      )
    case 'nutrition':
      return <NutritionView />
    case 'profile':
      return <ProfileView />
  }
}

export function AppShell() {
  const [phase, setPhase] = useState<AppPhase>('loading')
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [launchRoutineId, setLaunchRoutineId] = useState<string | null>(null)
  const { openAuth, isAuthenticated, isLoading } = useAuth()

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
    }
  }, [isAuthenticated])

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
    setActiveTab('training')
  }

  const handleOpenTraining = () => {
    if (!isAuthenticated) {
      openAuth()
      return
    }
    setLaunchRoutineId(null)
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
  }

  const handleOnboardingComplete = () => {
    setPhase('main')
    setActiveTab('home')
  }

  if (isLoading) {
    return (
      <>
        <AppBootScreen />
        <AuthBottomSheet />
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <WelcomeScreen onConnect={() => openAuth()} />
        <AuthBottomSheet />
      </>
    )
  }

  if (phase === 'onboarding') {
    return (
      <>
        <GlobalOnboardingScreen onComplete={handleOnboardingComplete} />
        <AuthBottomSheet />
      </>
    )
  }

  return (
    <>
      <AppLayout activeTab={activeTab} onTabChange={handleTabChange}>
        {renderActiveView(
          activeTab,
          handleStartTraining,
          handleOpenTraining,
          handleOpenNutrition,
          launchRoutineId,
          handleLaunchConsumed,
          () => setActiveTab('home'),
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
