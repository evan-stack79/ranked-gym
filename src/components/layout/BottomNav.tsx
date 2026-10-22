import { Dumbbell, Home, Play, Salad, User } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
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

/** Soft active bubble diameter — keep in sync with `.bottom-nav-pill__bubble` width. */
const PILL_BUBBLE_SIZE_PX = 36

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
      <span
        className={`rg-play-breathe flex items-center justify-center rounded-full border-4 border-[#171719] bg-[#FF2B2B] text-white transition-[height,width] duration-180 motion-reduce:transition-none ${compact ? 'h-12 w-12 -mt-1' : 'h-14 w-14 -mt-5'}`}
        data-rg-anim="play-breathe"
      >
        <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={labelClass}>{hasActiveWorkout ? 'Reprendre' : 'Nouvelle séance'}</span>
    </button>
  )

  return (
    <nav
      className={`fixed left-3 right-3 z-50 mx-auto rounded-[22px] border border-[#38383D] bg-[#171719] px-1.5 py-1.5 transition-[max-width,padding] duration-180 ease-out motion-reduce:transition-none ${compact ? 'max-w-[22rem]' : 'max-w-lg'}`}
      aria-label="Navigation principale"
      data-bottom-nav-mode={compact ? 'compact' : 'expanded'}
      data-bottom-nav-variant="dock"
      style={{
        bottom: 'max(0.75rem, var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
      }}
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
  const trackRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})
  const [bubbleX, setBubbleX] = useState(0)
  const [bubbleReady, setBubbleReady] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const track = trackRef.current
      const tab = tabRefs.current[activeTab]
      if (!track || !tab) return
      const trackRect = track.getBoundingClientRect()
      const tabRect = tab.getBoundingClientRect()
      const x = tabRect.left - trackRect.left + (tabRect.width - PILL_BUBBLE_SIZE_PX) / 2
      setBubbleX(x)
      setBubbleReady(true)
    }

    measure()
    const track = trackRef.current
    if (!track || typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }

    const ro = new ResizeObserver(measure)
    ro.observe(track)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [activeTab])

  const centralAction = (
    <button
      type="button"
      onClick={onStartTraining}
      className="ios-press bottom-nav-pill__center relative z-10 flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center rounded-full px-1"
      aria-label={hasActiveWorkout ? 'Reprendre' : 'Nouvelle séance'}
      data-nav-center={hasActiveWorkout ? 'resume' : 'new'}
    >
      <span
        className="rg-play-breathe flex h-12 w-12 items-center justify-center rounded-full bg-[#FF2B2B] text-white shadow-[0_6px_18px_rgb(255_43_43_/_0.45)] ring-4 ring-[#0C0C0E]/55"
        data-rg-anim="play-breathe"
      >
        <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.25} aria-hidden="true" />
      </span>
    </button>
  )

  return (
    <nav
      className="bottom-nav-pill fixed left-1/2 z-50 -translate-x-1/2 rounded-full px-2 py-1.5"
      aria-label="Navigation principale"
      data-bottom-nav-mode="pill"
      data-bottom-nav-variant="floating-pill"
      style={{
        bottom: 'max(0.5rem, var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
        width: 'min(22.5rem, calc(100vw - 2.5rem))',
      }}
    >
      <div ref={trackRef} className="bottom-nav-pill__track relative flex items-center justify-between gap-0.5">
        <span
          className="bottom-nav-pill__bubble"
          aria-hidden="true"
          data-nav-bubble
          data-ready={bubbleReady ? 'true' : 'false'}
          style={{
            transform: `translate3d(${bubbleX}px, -50%, 0)`,
            opacity: bubbleReady ? 1 : 0,
          }}
        />
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id
          const item = (
            <button
              key={id}
              type="button"
              ref={(el) => {
                tabRefs.current[id] = el
              }}
              onClick={() => onTabChange(id)}
              className={`ios-press bottom-nav-pill__tab relative z-[1] flex h-11 min-h-11 min-w-11 flex-1 items-center justify-center rounded-full px-1 transition-colors duration-150 motion-reduce:transition-none ${
                isActive ? 'text-[#FF2B2B]' : 'text-[#EBEBF5]'
              }`}
              aria-current={isActive ? 'page' : undefined}
              aria-label={label}
              data-nav-tab={id}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full">
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
