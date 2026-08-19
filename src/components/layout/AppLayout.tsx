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
    <div className="flex min-h-full flex-col bg-ios-bg font-sans">
      <header className="glass-bar sticky top-0 z-40 border-b border-gray-800">
        <div
          className="mx-auto flex max-w-lg items-center justify-center px-4 py-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <span className="text-[17px] font-semibold tracking-tight text-white">Ranked Gym</span>
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-lg flex-1 overflow-y-auto px-5 py-8"
        style={{ paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}
