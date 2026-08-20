import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { AuthBottomSheet } from './components/auth/AuthBottomSheet'
import { AppLayout } from './components/layout/AppLayout'
import { HomeView } from './components/home/HomeView'
import { LobbyView } from './components/lobby/LobbyView'
import { TrainingView } from './components/training/TrainingView'
import { ForceView } from './components/force/ForceView'
import { NutritionView } from './components/nutrition/NutritionView'
import { ProfileView } from './components/profile/ProfileView'
import type { TabId } from './types'

function renderActiveView(tab: TabId) {
  switch (tab) {
    case 'home':
      return <HomeView />
    case 'lobby':
      return <LobbyView />
    case 'training':
      return <TrainingView />
    case 'force':
      return <ForceView />
    case 'nutrition':
      return <NutritionView />
    case 'profile':
      return <ProfileView />
  }
}

function AppShell() {
  const [activeTab, setActiveTab] = useState<TabId>('home')
  const { requireAuth, isAuthenticated } = useAuth()

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

  return (
    <>
      <AppLayout activeTab={activeTab} onTabChange={handleTabChange}>
        {renderActiveView(activeTab)}
      </AppLayout>
      <AuthBottomSheet />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
