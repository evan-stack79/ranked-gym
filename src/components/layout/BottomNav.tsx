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
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-anthracite/95 backdrop-blur-lg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 py-2">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`relative flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 transition-colors ${
                isActive
                  ? 'text-neon-green'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={`h-5 w-5 ${isActive ? 'drop-shadow-[0_0_6px_rgba(0,255,136,0.6)]' : ''}`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium ${isActive ? 'neon-text-green' : ''}`}>
                {label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 h-0.5 w-8 rounded-full bg-neon-green neon-glow-green" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
