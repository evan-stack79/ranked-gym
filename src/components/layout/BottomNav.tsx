import { Dumbbell, Home, Play, Salad, User } from 'lucide-react'
import { isAccueilGalleryEnabled } from '../../backend/accueilGalleryFeatureFlag'
import type { TabId } from '../../types'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onStartTraining?: () => void
  hasActiveWorkout?: boolean
  compact?: boolean
  onExpand?: () => void
  /** Override preview flag — tests / capture harness. */
  floatingPill?: boolean
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
  floatingPill,
}: BottomNavProps) {
  const usePill = floatingPill ?? isAccueilGalleryEnabled()

  if (usePill) {
    return (
      <FloatingPillBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onStartTraining={onStartTraining}
        hasActiveWorkout={hasActiveWorkout}
      />
    )
  }

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
      data-bottom-nav-variant="dock"
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

/** Floating frosted pill — icons only, centered above home indicator. */
function FloatingPillBottomNav({
  activeTab,
  onTabChange,
  onStartTraining,
  hasActiveWorkout,
}: {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onStartTraining: () => void
  hasActiveWorkout: boolean
}) {
  const centralAction = (
    <button
      type="button"
      onClick={onStartTraining}
      className="ios-press relative z-10 flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center rounded-full px-1"
      aria-label={hasActiveWorkout ? 'Reprendre' : 'Nouvelle séance'}
      data-nav-center={hasActiveWorkout ? 'resume' : 'new'}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2B2B] text-white shadow-[0_6px_18px_rgb(255_43_43_/_0.45)] ring-4 ring-[#0C0C0E]/55">
        <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.25} aria-hidden="true" />
      </span>
    </button>
  )

  return (
    <nav
      className="bottom-nav-pill fixed bottom-[max(0.5rem,env(safe-area-inset-bottom,0px))] left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/12 px-2 py-1.5 shadow-[0_10px_40px_rgb(0_0_0_/_0.45)]"
      aria-label="Navigation principale"
      data-bottom-nav-mode="pill"
      data-bottom-nav-variant="floating-pill"
      style={{
        backgroundColor: 'rgb(23 23 25 / 0.72)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        width: 'min(22.5rem, calc(100vw - 2.5rem))',
      }}
    >
      <div className="flex items-center justify-between gap-0.5">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          const item = (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={`ios-press flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center rounded-full px-1 transition-colors duration-150 motion-reduce:transition-none ${
                isActive ? 'text-[#FF2B2B]' : 'text-[#AEAEB2]'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ${
                  isActive ? 'bg-[#FF2B2B]/15' : ''
                }`}
              >
                <Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.35 : 1.75} aria-hidden="true" />
              </span>
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
