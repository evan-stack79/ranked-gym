import { useRef, type ReactNode } from 'react'
import { useAuth } from '../../context/AuthContext'
import { BrandMark } from '../brand/BrandMark'
import { BottomNav } from './BottomNav'
import { StreakCelebrationHost } from '../streak/StreakCelebrationHost'
import { RestTimerOverlay, REST_BAR_CONTENT_PAD } from '../training/RestTimerOverlay'
import { useRestTimerContext, type RestPresetSec } from '../../context/RestTimerContext'
import type { TabId } from '../../types'
import { useAdaptiveBottomNav } from '../../hooks/useAdaptiveBottomNav'

interface AppLayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onStartTraining?: () => void
  hasActiveWorkout?: boolean
  hideBottomNav?: boolean
  children: ReactNode
}

export function AppLayout({
  activeTab,
  onTabChange,
  onStartTraining = () => onTabChange('training'),
  hasActiveWorkout = false,
  hideBottomNav = false,
  children,
}: AppLayoutProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const { streakCelebration } = useAuth()
  const {
    state,
    isBarVisible,
    readyBarEnabled,
    chromeHidden,
    start,
    pause,
    resume,
    skip,
    dismiss,
  } = useRestTimerContext()

  const streakCelebrationActive = Boolean(streakCelebration)
  const showHeader = !chromeHidden
  const { mode: bottomNavMode, keyboardOpen, expand } = useAdaptiveBottomNav({ mainRef, resetKey: activeTab })
  const showBottomNav = !chromeHidden && !hideBottomNav && !keyboardOpen
  const bottomNavObscured = streakCelebrationActive
  const showReadyBar = !chromeHidden && activeTab === 'training' && readyBarEnabled

  return (
    <div
      ref={shellRef}
      className="relative flex h-full min-h-0 flex-col mesh-bg font-sans"
      data-streak-celebration-active={streakCelebrationActive ? '' : undefined}
      inert={streakCelebrationActive ? true : undefined}
    >
      <main
        ref={mainRef}
        className={`relative z-10 min-h-0 w-full flex-1 overflow-y-auto ${
          chromeHidden ? 'max-w-none' : ''
        }`}
        style={
          chromeHidden
            ? { paddingBottom: 0 }
            : {
                paddingBottom:
                  bottomNavObscured
                    ? '1.5rem'
                    : isBarVisible
                      ? `calc(var(--app-bottom-nav) + ${REST_BAR_CONTENT_PAD} + env(safe-area-inset-bottom, 0px) + 1.5rem)`
                      : 'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
              }
        }
        aria-hidden={streakCelebrationActive ? true : undefined}
      >
        {showHeader ? (
          <header
            className="border-b border-white/5 bg-[#0C0C0E]"
            data-app-brand-header="1"
            aria-hidden={streakCelebrationActive ? true : undefined}
          >
            <div
              className="mx-auto flex max-w-lg items-center justify-center px-4 py-3"
              style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
            >
              <div data-cold-launch-target="compact">
                <BrandMark variant="compact" />
              </div>
            </div>
          </header>
        ) : null}

        <div
          className={
            chromeHidden ? undefined : 'mx-auto w-full max-w-lg px-5 py-8'
          }
        >
          {children}
        </div>
      </main>

      {!chromeHidden ? (
        <>
          <RestTimerOverlay
            showReadyBar={showReadyBar}
            state={state}
            onPreset={(sec: RestPresetSec) => {
              const target = state.target ?? {
                exerciseId: 'quick-rest',
                setIndex: 0,
                exerciseName: 'Repos libre',
                setLabel: `${sec}s`,
              }
              start(sec, {
                ...target,
                setLabel: target.exerciseId === 'quick-rest' ? `${sec}s` : target.setLabel,
              })
            }}
            onSkip={skip}
            onDismiss={dismiss}
            onPause={pause}
            onResume={resume}
          />
          {showBottomNav ? (
            <div
              data-bottom-nav-host
              className={bottomNavObscured ? 'pointer-events-none invisible' : undefined}
              inert={bottomNavObscured ? true : undefined}
              aria-hidden={bottomNavObscured ? true : undefined}
            >
              <BottomNav
                activeTab={activeTab}
                onTabChange={onTabChange}
                onStartTraining={onStartTraining}
                hasActiveWorkout={hasActiveWorkout}
                compact={bottomNavMode === 'compact'}
                onExpand={expand}
              />
            </div>
          ) : null}
        </>
      ) : null}
      <StreakCelebrationHost shellRef={shellRef} />
    </div>
  )
}
