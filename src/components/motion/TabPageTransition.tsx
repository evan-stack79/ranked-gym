import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { TAB_FADE_MS } from './sessionActionGuards'
import type { TabId } from '../../types'

export type TabPageTransitionProps = {
  tabId: TabId
  children: ReactNode
  className?: string
}

/**
 * Short fade between bottom-bar tabs. Sticky header / nav stay put
 * (only the page panel animates). Reduced-motion → instant swap.
 */
export function TabPageTransition({ tabId, children, className = '' }: TabPageTransitionProps) {
  const reduced = usePrefersReducedMotion()
  const prevTab = useRef(tabId)
  const [phase, setPhase] = useState<'idle' | 'in'>('idle')
  const [panel, setPanel] = useState(children)

  useEffect(() => {
    if (tabId === prevTab.current) {
      setPanel(children)
      return
    }
    prevTab.current = tabId
    if (reduced) {
      setPanel(children)
      setPhase('idle')
      return
    }
    setPanel(children)
    setPhase('in')
    const id = window.setTimeout(() => setPhase('idle'), TAB_FADE_MS)
    return () => window.clearTimeout(id)
  }, [tabId, children, reduced])

  return (
    <div
      className={`rg-tab-fade ${phase === 'in' ? 'rg-tab-fade--in' : ''} ${className}`}
      data-rg-anim="tab-fade"
      data-rg-tab={tabId}
      data-rg-motion={reduced ? 'reduced' : 'ok'}
    >
      {panel}
    </div>
  )
}
