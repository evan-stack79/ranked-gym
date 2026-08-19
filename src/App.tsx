import { useState } from 'react'
import { AppLayout } from './components/layout/AppLayout'
import { HomeView } from './components/home/HomeView'
import { LobbyView } from './components/lobby/LobbyView'
import { TrainingView } from './components/training/TrainingView'
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
    case 'profile':
      return <ProfileView />
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home')

  return (
    <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderActiveView(activeTab)}
    </AppLayout>
  )
}
