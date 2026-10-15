import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { animMs } from './animTiming'
import { TAB_FADE_MS } from './sessionActionGuards'
import type { TabId } from '../../types'

export type TabPageTransitionProps = {
  tabId: TabId
  children: ReactNode
  className?: string
}

/**
 * Short tab transition. Keeps the outgoing page painted until the incoming
 * panel has faded in — never an empty frame between tabs.
 * Reduced-motion → instant swap.
 */
export function TabPageTransition({ tabId, children, className = '' }: TabPageTransitionProps) {
  const reduced = usePrefersReducedMotion()
  const prevTab = useRef(tabId)
  const [phase, setPhase] = useState<'idle' | 'in'>('idle')
  const [incoming, setIncoming] = useState(children)
  const [outgoing, setOutgoing] = useState<ReactNode | null>(null)
  const incomingRef = useRef(children)
  incomingRef.current = incoming

  useEffect(() => {
    if (tabId === prevTab.current) {
      setIncoming(children)
      return
    }
    const previous = incomingRef.current
    prevTab.current = tabId
    if (reduced) {
      setOutgoing(null)
      setIncoming(children)
      setPhase('idle')
      return
    }
    // Keep outgoing painted under the incoming fade-in — never clear early.
    setOutgoing(previous)
    setIncoming(children)
    setPhase('in')
    const id = window.setTimeout(() => {
      setOutgoing(null)
      setPhase('idle')
      // Small buffer past CSS duration so the last painted outgoing frame is never dropped.
    }, animMs(TAB_FADE_MS) + 32)
    return () => window.clearTimeout(id)
  }, [tabId, children, reduced])

  return (
    <div
      className={`rg-tab-fade ${phase === 'in' ? 'rg-tab-fade--crossing' : ''} ${className}`}
      data-rg-anim="tab-fade"
      data-rg-tab={tabId}
      data-rg-motion={reduced ? 'reduced' : 'ok'}
      data-rg-tab-phase={phase}
    >
      {outgoing ? (
        <div className="rg-tab-fade__layer rg-tab-fade__layer--out" aria-hidden="true">
          {outgoing}
        </div>
      ) : null}
      <div
        className={`rg-tab-fade__layer rg-tab-fade__layer--in${
          phase === 'in' ? ' rg-tab-fade--in' : ''
        }`}
      >
        {incoming}
      </div>
    </div>
  )
}
