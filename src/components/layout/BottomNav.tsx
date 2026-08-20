import { Home, Users, Dumbbell, User } from 'lucide-react'
import type { TabId } from '../../types'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'lobby', label: 'Lobby', icon: Users },
  { id: 'training', label: 'Entraînement', icon: Dumbbell },
  { id: 'profile', label: 'Profil', icon: User },
]

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      className="glass-bar fixed bottom-0 left-0 right-0 z-50 border-t border-white/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 transition-colors ${
                isActive ? 'text-[#FF2B2B]' : 'text-[#8E8E93]'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.25 : 1.75} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
