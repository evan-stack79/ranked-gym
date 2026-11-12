import { Dumbbell, Home, Moon, Play, Salad, User } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { TabId } from '../../types'

interface BottomNavProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onStartTraining?: () => void
  hasActiveWorkout?: boolean
  compact?: boolean
  onExpand?: () => void
  /**
   * Opt-in floating pill (icons only). Default = dock avec libellés
   * (Evan GO v11 : barre d’origine + 6 entrées, pas de pastille grise).
   */
  floatingPill?: boolean
}

const LEFT_TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'training', label: 'Train', icon: Dumbbell },
]

const RIGHT_TABS: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'nutrition', label: 'Nutri', icon: Salad },
  { id: 'sleep', label: 'Sommeil', icon: Moon },
  { id: 'profile', label: 'Profil', icon: User },
]

/** Soft active bubble diameter — keep in sync with `.bottom-nav-pill__bubble` width. */
const PILL_BUBBLE_SIZE_PX = 36

function DockTabButton({
  id,
  label,
  icon: Icon,
  active,
  compact,
  onSelect,
  labelClass,
}: {
  id: TabId
  label: string
  icon: typeof Home
  active: boolean
  compact: boolean
  onSelect: () => void
  labelClass: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`ios-press flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 transition-colors duration-150 ${
        active ? 'text-[#FF0702]' : 'text-[#ACB4BA]'
      }`}
      aria-current={active ? 'page' : undefined}
      aria-label={label}
      data-nav-tab={id}
    >
      <Icon
        className={compact ? 'h-[20px] w-[20px]' : 'h-[22px] w-[22px]'}
        strokeWidth={active ? 2.25 : 1.75}
        aria-hidden="true"
      />
      <span className={labelClass}>{label}</span>
    </button>
  )
}

export function BottomNav({
  activeTab,
  onTabChange,
  onStartTraining = () => onTabChange('training'),
  hasActiveWorkout = false,
  compact = false,
  onExpand,
  floatingPill = false,
}: BottomNavProps) {
  if (floatingPill) {
    return (
      <FloatingPillBottomNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        onStartTraining={onStartTraining}
        hasActiveWorkout={hasActiveWorkout}
      />
    )
  }

  // Libellés lisibles à 6 entrées sur 390–440 pt.
  const labelClass = `text-[10px] leading-tight transition-opacity duration-180 motion-reduce:transition-none ${
    compact ? 'invisible absolute opacity-0' : 'opacity-100'
  }`

  // PLAY centré : colonnes egales L/R (2 onglets | PLAY | 3 onglets).
  const centralAction = (
    <button
      type="button"
      onClick={onStartTraining}
      className="ios-press relative z-10 flex shrink-0 flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[#ACB4BA] transition-colors duration-150"
      aria-label={hasActiveWorkout ? 'Reprendre' : 'Nouvelle séance'}
      data-nav-center={hasActiveWorkout ? 'resume' : 'new'}
    >
      <span
        className={`flex items-center justify-center rounded-full border-4 border-[#171719] bg-[#FF0702] text-white transition-[height,width] duration-180 motion-reduce:transition-none ${
          compact ? 'h-12 w-12 -mt-1' : 'h-14 w-14 -mt-5'
        }`}
      >
        <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.25} aria-hidden="true" />
      </span>
      <span className={labelClass}>{hasActiveWorkout ? 'Reprendre' : 'Nouvelle séance'}</span>
    </button>
  )

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[#38383D] bg-[#171719] px-1 pt-1.5 transition-[padding] duration-180 ease-out motion-reduce:transition-none"
      aria-label="Navigation principale"
      data-bottom-nav-mode={compact ? 'compact' : 'expanded'}
      data-bottom-nav-variant="dock"
      data-bottom-nav-edge="flush"
      style={{
        paddingBottom: 'var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px))',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onExpand?.()
      }}
      onFocusCapture={onExpand}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-0">
        <div className="flex min-w-0 items-end">
          {LEFT_TABS.map(({ id, label, icon }) => (
            <DockTabButton
              key={id}
              id={id}
              label={label}
              icon={icon}
              active={activeTab === id}
              compact={compact}
              onSelect={() => onTabChange(id)}
              labelClass={labelClass}
            />
          ))}
        </div>
        {centralAction}
        <div className="flex min-w-0 items-end">
          {RIGHT_TABS.map(({ id, label, icon }) => (
            <DockTabButton
              key={id}
              id={id}
              label={label}
              icon={icon}
              active={activeTab === id}
              compact={compact}
              onSelect={() => onTabChange(id)}
              labelClass={labelClass}
            />
          ))}
        </div>
      </div>
    </nav>
  )
}

/** Floating frosted pill — opt-in only (tests / harness). */
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
  const tabs = [...LEFT_TABS, ...RIGHT_TABS]

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
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FF0702] text-white ring-4 ring-[#171719]">
        <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.25} aria-hidden="true" />
      </span>
    </button>
  )

  return (
    <nav
      className="bottom-nav-pill fixed inset-x-0 bottom-0 z-50 rounded-none rounded-t-[28px] px-2 pt-1.5"
      aria-label="Navigation principale"
      data-bottom-nav-mode="pill"
      data-bottom-nav-variant="floating-pill"
      data-bottom-nav-edge="flush"
      style={{
        paddingBottom: 'var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px))',
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
        {tabs.map(({ id, label, icon: Icon }, index) => {
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
                isActive ? 'text-[#FF0702]' : 'text-[#EBEBF5]'
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
          // Insert PLAY after Train (index 1) so order stays Accueil·Train·PLAY·Nutri·Sommeil·Profil
          if (index === 1) {
            return (
              <div key={`${id}-group`} className="contents">
                {item}
                {centralAction}
              </div>
            )
          }
          return item
        })}
      </div>
    </nav>
  )
}
