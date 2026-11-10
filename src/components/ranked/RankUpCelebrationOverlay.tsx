import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { animate } from 'motion/mini'
import type { RankTier } from '../../types'
import { getRankFromLevel } from '../../utils/rank'
import { rankVisuals } from '../../utils/rankVisuals'
import { fireRankUpConfetti } from '../../motion/rankUpConfetti'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { BrandMark } from '../brand/BrandMark'

export type RankUpCelebrationOverlayProps = {
  previousLevel: number
  nextLevel: number
  currentXp: number
  xpToNextLevel?: number
  onComplete: () => void
  forceReducedMotion?: boolean
}

function HexBadge({
  tier,
  division,
  visible,
  badgeRef,
}: {
  tier: RankTier
  division: string
  visible: boolean
  badgeRef?: RefObject<SVGSVGElement | null>
}) {
  const visual = rankVisuals[tier]
  return (
    <svg
      ref={badgeRef}
      viewBox="0 0 180 200"
      className="absolute inset-0 h-full w-full"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden
    >
      <path
        d="M90 8 L166 50 V150 L90 192 L14 150 V50Z"
        fill="#1d1f20"
        stroke={`rgba(${visual.haloRgb}, 0.9)`}
        strokeWidth="6"
      />
      <path
        d="M90 40 L136 66 V134 L90 160 L44 134 V66Z"
        fill="none"
        stroke={tier === 'Argent' || tier === 'Or' ? '#ff0702' : `rgba(${visual.haloRgb}, 0.55)`}
        strokeWidth="3"
      />
      <text
        x="90"
        y="116"
        textAnchor="middle"
        fontSize="40"
        fontWeight="800"
        fill="#eceeef"
        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {division}
      </text>
    </svg>
  )
}

/**
 * Montée de rang Ranked — badge spring + 2 salves canvas-confetti.
 * Reduced-motion: swap instantané, aucun confetti.
 */
export function RankUpCelebrationOverlay({
  previousLevel,
  nextLevel,
  currentXp,
  xpToNextLevel = 1000,
  onComplete,
  forceReducedMotion,
}: RankUpCelebrationOverlayProps) {
  const reducedHook = usePrefersReducedMotion()
  const reduced = forceReducedMotion ?? reducedHook
  const from = getRankFromLevel(previousLevel)
  const to = getRankFromLevel(nextLevel)
  const [showNew, setShowNew] = useState(reduced)
  const oldBadgeRef = useRef<SVGSVGElement>(null)
  const newBadgeRef = useRef<SVGSVGElement>(null)
  const titleOldRef = useRef<HTMLSpanElement>(null)
  const titleNewRef = useRef<HTMLSpanElement>(null)
  const msgRef = useRef<HTMLParagraphElement>(null)
  const barRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    let cancelled = false
    const timers: number[] = []
    let cancelConfetti: (() => void) | undefined

    const run = async () => {
      if (reduced) {
        setShowNew(true)
        if (msgRef.current) msgRef.current.style.opacity = '1'
        if (barRef.current) barRef.current.style.transform = 'scaleX(1)'
        return
      }

      if (barRef.current) {
        animate(
          barRef.current,
          { transform: ['scaleX(0.92)', 'scaleX(1)'] },
          { duration: 0.4, ease: [0.23, 1, 0.32, 1] },
        )
      }

      await new Promise<void>((r) => {
        timers.push(window.setTimeout(r, 650))
      })
      if (cancelled) return

      if (oldBadgeRef.current) {
        animate(
          oldBadgeRef.current,
          { opacity: [1, 0], transform: ['scale(1)', 'scale(0.85)'] },
          { duration: 0.18 },
        )
      }
      if (titleOldRef.current) {
        animate(
          titleOldRef.current,
          { opacity: [1, 0], transform: ['translateY(0)', 'translateY(-10px)'] },
          { duration: 0.18 },
        )
      }

      await new Promise<void>((r) => {
        timers.push(window.setTimeout(r, 140))
      })
      if (cancelled) return

      setShowNew(true)
      if (newBadgeRef.current) {
        animate(
          newBadgeRef.current,
          { opacity: [0, 1], transform: ['scale(0.8)', 'scale(1)'] },
          { type: 'spring', visualDuration: 0.35, bounce: 0.4 },
        )
      }
      if (titleNewRef.current) {
        animate(
          titleNewRef.current,
          { opacity: [0, 1], transform: ['translateY(10px)', 'translateY(0)'] },
          { type: 'spring', visualDuration: 0.3, bounce: 0.3 },
        )
      }

      const burst = fireRankUpConfetti({ reducedMotion: false })
      cancelConfetti = burst.cancel

      await new Promise<void>((r) => {
        timers.push(window.setTimeout(r, 280))
      })
      if (cancelled) return

      if (msgRef.current) {
        animate(msgRef.current, { opacity: [0, 1] }, { duration: 0.3 })
      }
    }

    void run()
    return () => {
      cancelled = true
      cancelConfetti?.()
      for (const id of timers) window.clearTimeout(id)
    }
  }, [reduced])

  const xpLabel = `${Math.min(currentXp, xpToNextLevel).toLocaleString('fr-FR')} / ${xpToNextLevel.toLocaleString('fr-FR')} XP`

  const ui = (
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col bg-[#0B0B0D]"
      role="dialog"
      aria-modal="true"
      aria-label={`Montée de rang ${to.tier}`}
      data-rg-rank-up
      data-rg-motion={reduced ? 'reduced' : 'on'}
    >
      <div
        className="flex justify-center pt-10"
        style={{ paddingTop: 'max(2.5rem, env(safe-area-inset-top))' }}
      >
        <BrandMark variant="compact" />
      </div>

      <p className="mt-6 text-center text-[12px] font-bold uppercase tracking-[0.16em] text-[#ACB4BA]">
        Rang
      </p>

      <div className="relative mx-auto mt-8 h-[200px] w-[180px]">
        <HexBadge
          tier={from.tier}
          division={from.division}
          visible={!showNew}
          badgeRef={oldBadgeRef}
        />
        <HexBadge
          tier={to.tier}
          division={to.division}
          visible={showNew}
          badgeRef={newBadgeRef}
        />
      </div>

      <div className="relative mx-auto mt-5 h-[42px] w-full text-center text-[34px] font-extrabold tracking-[-0.02em]">
        <span
          ref={titleOldRef}
          className="absolute inset-x-0"
          style={{
            color: `rgba(${rankVisuals[from.tier].haloRgb}, 0.95)`,
            opacity: showNew ? 0 : 1,
          }}
        >
          {from.tier}
        </span>
        <span
          ref={titleNewRef}
          className="absolute inset-x-0 text-white"
          style={{ opacity: showNew ? 1 : 0 }}
        >
          {to.tier}
        </span>
      </div>

      <p
        ref={msgRef}
        className="mt-2 text-center text-[16px] text-[#ACB4BA]"
        style={{ opacity: 0 }}
      >
        Tu passes {to.tier}. Bien joué.
      </p>

      <div className="mx-7 mt-10">
        <div className="flex justify-between text-[13px] tabular-nums text-[#ACB4BA]">
          <span>{xpLabel}</span>
          <span>{to.tier}</span>
        </div>
        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[#2c3032]">
          <span
            ref={barRef}
            className="block h-full origin-left rounded-full bg-[#ff0702]"
            style={{ transform: 'scaleX(0.92)' }}
          />
        </div>
      </div>

      <div
        className="mt-auto px-6"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onComplete}
          className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
        >
          Continuer
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(ui, document.body)
}
