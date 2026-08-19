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
    <div className="flex min-h-full flex-col bg-[#0a0a0f]">
      <div
        className="pointer-events-none fixed inset-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -left-32 -top-32 h-64 w-64 rounded-full bg-neon-green/5 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 h-64 w-64 rounded-full bg-neon-blue/5 blur-3xl" />
      </div>

      <main
        className="relative mx-auto w-full max-w-lg flex-1 overflow-y-auto px-4 pt-6"
        style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        {children}
      </main>

      <BottomNav activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  )
}
