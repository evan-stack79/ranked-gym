import { Dumbbell, Home, Play, Salad, User } from 'lucide-react'
import type { TabId } from '../../types'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onStartTraining?: () => void
  hasActiveWorkout?: boolean
  compact?: boolean
  onExpand?: () => void
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'training', label: 'Train', icon: Dumbbell },
  { id: 'nutrition', label: 'Nutri', icon: Salad },
  { id: 'profile', label: 'Profil', icon: User },
]

export function BottomNav({
  activeTab,
  onTabChange,
  onStartTraining = () => onTabChange('training'),
  hasActiveWorkout = false,
  compact = false,
  onExpand,
}: BottomNavProps) {
  const labelClass = `text-[11px] leading-tight transition-opacity duration-180 motion-reduce:transition-none ${compact ? 'invisible absolute opacity-0' : 'opacity-100'}`
  const centralAction = (
    <button
      type="button"
      onClick={onStartTraining}
      className="ios-press flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[#AEAEB2] transition-colors duration-150"
      aria-label={hasActiveWorkout ? 'Reprendre' : 'Nouvelle séance'}
      data-nav-center={hasActiveWorkout ? 'resume' : 'new'}
    >
      <span className={`flex items-center justify-center rounded-full border-4 border-[#171719] bg-[#FF2B2B] text-white transition-[height,width] duration-180 motion-reduce:transition-none ${compact ? 'h-12 w-12 -mt-1' : 'h-14 w-14 -mt-5'}`}>
        <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={labelClass}>{hasActiveWorkout ? 'Reprendre' : 'Nouvelle séance'}</span>
    </button>
  )

  return (
    <nav
      className={`fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 right-3 z-50 mx-auto rounded-[22px] border border-[#38383D] bg-[#171719] px-1.5 py-1.5 transition-[max-width,padding] duration-180 ease-out motion-reduce:transition-none ${compact ? 'max-w-[22rem]' : 'max-w-lg'}`}
      aria-label="Navigation principale"
      data-bottom-nav-mode={compact ? 'compact' : 'expanded'}
      onClick={(event) => {
        if (event.target === event.currentTarget) onExpand?.()
      }}
      onFocusCapture={onExpand}
    >
      <div className="flex items-end justify-between gap-0.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          const item = (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`ios-press flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 transition-colors duration-150 ${isActive ? 'text-[#FF2B2B]' : 'text-[#AEAEB2]'}`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
              <span className={labelClass}>{label}</span>
            </button>
          )
          return id === 'nutrition' ? (
            <div key="nutrition-group" className="contents">
              {centralAction}
              {item}
            </div>
          ) : item
        })}
      </div>
    </nav>
  )
}
