import { useEffect, useRef, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RestTimerProvider } from './context/RestTimerContext'
import { AuthBottomSheet } from './components/auth/AuthBottomSheet'
import { AppLayout } from './components/layout/AppLayout'
import { AppBootScreen } from './components/ui/AppBootScreen'
import { SupabaseConfigBanner } from './components/ui/SupabaseConfigBanner'
import { GlobalOnboardingScreen } from './components/onboarding/GlobalOnboardingScreen'
import { HomeView } from './components/home/HomeView'
import { LobbyView } from './components/lobby/LobbyView'
import { TrainingView } from './components/training/TrainingView'
import { NutritionView } from './components/nutrition/NutritionView'
import { ProfileView } from './components/profile/ProfileView'
import { hasCompletedNutritionOnboarding } from './services/nutritionStorage'
import type { TabId } from './types'

type AppPhase = 'loading' | 'onboarding' | 'main'

function renderActiveView(
  tab: TabId,
  onStartTraining: (routineId: string) => void,
  launchRoutineId: string | null,
  onLaunchConsumed: () => void,
) {
  switch (tab) {
    case 'home':
      return <HomeView onStartTraining={onStartTraining} />
    case 'lobby':
      return <LobbyView />
    case 'training':
      return (
        <TrainingView
          launchRoutineId={launchRoutineId}
          onLaunchConsumed={onLaunchConsumed}
        />
      )
    case 'nutrition':
      return <NutritionView />
    case 'profile':
      return <ProfileView />
  }
}

function AppShell() {
  const [phase, setPhase] = useState<AppPhase>('loading')
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [launchRoutineId, setLaunchRoutineId] = useState<string | null>(null)
  const launchGateApplied = useRef(false)
  const { requireAuth, isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (isLoading) {
      setPhase('loading')
      return
    }

    if (!launchGateApplied.current) {
      launchGateApplied.current = true
      setPhase(hasCompletedNutritionOnboarding() ? 'main' : 'onboarding')
    }
  }, [isLoading])

  useEffect(() => {
    const syncOnboardingPhase = () => {
      if (hasCompletedNutritionOnboarding()) {
        setPhase((current) => (current === 'onboarding' ? 'main' : current))
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
    if (!isAuthenticated && activeTab === 'profile') {
      setActiveTab('home')
    }
  }, [isAuthenticated, activeTab])

  const handleTabChange = (tab: TabId) => {
    if (tab === 'profile' && !isAuthenticated) {
      requireAuth(() => setActiveTab('profile'))
      return
    }
    setActiveTab(tab)
  }

  const handleStartTraining = (routineId: string) => {
    setLaunchRoutineId(routineId)
    setActiveTab('training')
  }

  const handleLaunchConsumed = () => {
    setLaunchRoutineId(null)
  }

  const handleOnboardingComplete = () => {
    setPhase('main')
    setActiveTab('home')
  }

  if (phase === 'loading') {
    return (
      <>
        <SupabaseConfigBanner />
        <div className="relative flex min-h-[100dvh] flex-col mesh-bg font-sans">
          <header
            className="glass-bar sticky top-0 z-40 border-b border-white/5"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <div className="mx-auto flex max-w-lg items-center justify-center px-4 py-3">
              <span className="text-[17px] font-semibold tracking-tight text-white">
                Ranked <span className="text-[#FF2B2B]">Gym</span>
              </span>
            </div>
          </header>
          <main className="relative z-10 mx-auto w-full max-w-lg flex-1 px-5 py-8">
            <AppBootScreen />
          </main>
        </div>
        <AuthBottomSheet />
      </>
    )
  }

  if (phase === 'onboarding') {
    return (
      <>
        <SupabaseConfigBanner />
        <GlobalOnboardingScreen onComplete={handleOnboardingComplete} />
        <AuthBottomSheet />
      </>
    )
  }

  return (
    <>
      <SupabaseConfigBanner />
      <AppLayout activeTab={activeTab} onTabChange={handleTabChange}>
        {renderActiveView(activeTab, handleStartTraining, launchRoutineId, handleLaunchConsumed)}
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
