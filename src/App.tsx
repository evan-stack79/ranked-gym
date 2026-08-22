import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { RestTimerProvider } from './context/RestTimerContext'
import { AuthBottomSheet } from './components/auth/AuthBottomSheet'
import { AppLayout } from './components/layout/AppLayout'
import { AppBootScreen } from './components/ui/AppBootScreen'
import { SupabaseConfigBanner } from './components/ui/SupabaseConfigBanner'
import { HomeView } from './components/home/HomeView'
import { LobbyView } from './components/lobby/LobbyView'
import { TrainingView } from './components/training/TrainingView'
import { NutritionView } from './components/nutrition/NutritionView'
import { ProfileView } from './components/profile/ProfileView'
import type { TabId } from './types'

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
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const [launchRoutineId, setLaunchRoutineId] = useState<string | null>(null)
  const { requireAuth, isAuthenticated, isLoading } = useAuth()

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

  return (
    <>
      <SupabaseConfigBanner />
      <AppLayout activeTab={activeTab} onTabChange={handleTabChange}>
        {isLoading ? (
          <AppBootScreen />
        ) : (
          renderActiveView(activeTab, handleStartTraining, launchRoutineId, handleLaunchConsumed)
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
