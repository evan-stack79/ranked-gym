import type { ReactNode } from 'react'
import { BottomNav } from './BottomNav'
import type { TabId } from '../../types'

interface AppLayoutProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  children: ReactNode
}

export function AppLayout({ activeTab, onTabChange, children }: AppLayoutProps) {
  return (
    <div className="relative flex min-h-full flex-col mesh-bg font-sans">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute -left-[20%] -top-[15%] h-[55vh] w-[70vw] rounded-full opacity-70 blur-[100px]"
          style={{ background: 'radial-gradient(circle, #0A1128 0%, transparent 70%)' }}
        />
        <div
          className="absolute -right-[15%] top-[5%] h-[45vh] w-[55vw] rounded-full opacity-50 blur-[110px]"
          style={{ background: 'radial-gradient(circle, #1a0a28 0%, transparent 68%)' }}
        />
        <div
          className="absolute -right-[10%] bottom-[20%] h-[35vh] w-[45vw] rounded-full opacity-35 blur-[90px]"
          style={{ background: 'radial-gradient(circle, #0A1128 0%, transparent 70%)' }}
        />
      </div>

      <header className="glass-bar sticky top-0 z-40 border-b border-white/5">
        <div
          className="mx-auto flex max-w-lg items-center justify-center px-4 py-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <span className="text-[17px] font-semibold tracking-tight text-white">Ranked Gym</span>
        </div>
      </header>

      <main
        className="relative z-10 mx-auto w-full max-w-lg flex-1 overflow-y-auto px-5 py-8"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}
