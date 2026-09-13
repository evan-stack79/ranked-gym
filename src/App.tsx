import { useEffect, useState, type ReactNode } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RestTimerProvider } from './context/RestTimerContext'
import { AuthBottomSheet } from './components/auth/AuthBottomSheet'
import { AppLayout } from './components/layout/AppLayout'
import { AppBootScreen } from './components/ui/AppBootScreen'
import { SupabaseConfigBanner } from './components/ui/SupabaseConfigBanner'
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

/** Shell minimal (boot / gate). `showBrandHeader` défaut = comportement historique. */
function SessionChrome({
  showBrandHeader = true,
  children,
}: {
  showBrandHeader?: boolean
  children: ReactNode
}) {
  return (
    <div className="relative flex min-h-[100dvh] flex-col mesh-bg font-sans">
      {showBrandHeader ? (
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
      ) : null}
      <main
        className="relative z-10 mx-auto w-full max-w-lg flex-1 px-5 py-8"
        style={
          showBrandHeader
            ? undefined
            : {
                // Compense le header masqué : safe area + air, sans bandeau vide.
                paddingTop: 'max(2rem, calc(env(safe-area-inset-top, 0px) + 1rem))',
              }
        }
      >
        {children}
      </main>
    </div>
  )
}

function AuthGateShell() {
  return (
    <SessionChrome showBrandHeader>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <p className="text-[22px] font-bold tracking-tight text-white">Bêta privée</p>
        <p className="max-w-sm text-[15px] leading-relaxed text-[#8E8E93]">
          Connexion requise. Accès sur invitation uniquement.
        </p>
      </div>
    </SessionChrome>
  )
}

function AppShell() {
  const [phase, setPhase] = useState<AppPhase>('loading')
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [launchRoutineId, setLaunchRoutineId] = useState<string | null>(null)
  const { openAuth, isAuthenticated, isLoading, isAuthOpen } = useAuth()

  useEffect(() => {
    if (isLoading) {
      setPhase('loading')
      return
    }

    // Pas de session Supabase → bloquer toute l’app (Accueil / Train / Nutri / Profil).
    if (!isAuthenticated) {
      setPhase('loading')
      return
    }

    setPhase(resolveLaunchPhase())
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    if (isLoading || isAuthenticated) return
    if (!isAuthOpen) openAuth()
  }, [isLoading, isAuthenticated, isAuthOpen, openAuth])

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
        <SupabaseConfigBanner />
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
        <AuthGateShell />
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
