import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import { RestTimerOverlay, REST_BAR_CONTENT_PAD } from '../training/RestTimerOverlay'
import {
  useRestTimerContext,
  type RestPresetSec,
} from '../../context/RestTimerContext'
import type { TabId } from '../../types'

interface AppLayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
}

export function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  const {
    state,
    isBarVisible,
    readyBarEnabled,
    chromeHidden,
    start,
    skip,
    dismiss,
  } = useRestTimerContext()

  const showReadyBar = !chromeHidden && activeTab === 'training' && readyBarEnabled

  return (
    <div className="relative flex min-h-full flex-col mesh-bg font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="arena-glow absolute -left-[30%] -top-[20%] h-[70vh] w-[90vw] rounded-full blur-[90px]"
          style={{ background: 'radial-gradient(circle, #5C1018 0%, #FF2B2B33 35%, transparent 70%)' }}
        />
        <div
          className="arena-glow absolute -right-[25%] top-[-5%] h-[60vh] w-[75vw] rounded-full blur-[100px]"
          style={{
            background: 'radial-gradient(circle, #0A1A40 0%, #00B4FF28 40%, transparent 72%)',
            animationDelay: '3s',
          }}
        />
        <div
          className="arena-glow absolute -left-[10%] bottom-[10%] h-[45vh] w-[60vw] rounded-full blur-[110px]"
          style={{
            background: 'radial-gradient(circle, #3B0A20 0%, #FF2B2B22 45%, transparent 70%)',
            animationDelay: '6s',
          }}
        />
        <div
          className="absolute right-[-5%] bottom-[25%] h-[40vh] w-[50vw] rounded-full opacity-40 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #1A0A38 0%, transparent 68%)' }}
        />
      </div>

      {!chromeHidden ? (
        <header className="glass-bar sticky top-0 z-40 border-b border-white/5">
          <div
            className="mx-auto flex max-w-lg items-center justify-center px-4 py-3"
            style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
          >
            <span className="text-[17px] font-semibold tracking-tight text-white">
              Ranked <span className="text-[#FF2B2B]">Gym</span>
            </span>
          </div>
        </header>
      ) : null}

      <main
        className={`relative z-10 mx-auto w-full flex-1 overflow-y-auto ${
          chromeHidden ? 'max-w-none px-0 py-0' : 'max-w-lg px-5 py-8'
        }`}
        style={
          chromeHidden
            ? { paddingBottom: 0 }
            : {
                paddingBottom: isBarVisible
                  ? `calc(var(--app-bottom-nav) + ${REST_BAR_CONTENT_PAD} + env(safe-area-inset-bottom, 0px) + 1.5rem)`
                  : 'calc(var(--app-bottom-nav) + env(safe-area-inset-bottom, 0px) + 1.5rem)',
              }
        }
      >
        {children}
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
          />
          <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
        </>
      ) : null}
    </div>
  )
}
