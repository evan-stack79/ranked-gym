import { useEffect, useRef } from 'react'
import { animate } from 'motion/mini'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export type BravoShineStats = {
  title: string
  durationMin: number
  volumeKg: number
  prCount: number
}

interface BravoShineProps {
  stats: BravoShineStats
  onContinue: () => void
  /** Test override. */
  forceReducedMotion?: boolean
}

/**
 * Fin de séance — « Bravo ! » spring entry + single 1.2 s shine.
 * No calorie copy (TCA-safe).
 */
export function BravoShine({ stats, onContinue, forceReducedMotion }: BravoShineProps) {
  const reducedHook = usePrefersReducedMotion()
  const reduced = forceReducedMotion ?? reducedHook
  const bravoRef = useRef<HTMLHeadingElement>(null)
  const dotRef = useRef<HTMLSpanElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const bravo = bravoRef.current
    const dot = dotRef.current
    const statsEl = statsRef.current
    if (!bravo || !dot || !statsEl) return

    let cancelled = false
    const timers: number[] = []

    const run = async () => {
      if (reduced) {
        await animate(bravo, { opacity: 1 }, { duration: 0.2 })
        if (cancelled) return
        dot.style.transform = 'scaleX(1)'
        await animate(statsEl, { opacity: 1 }, { duration: 0.2 })
        return
      }

      animate(
        bravo,
        { opacity: [0, 1], transform: ['scale(0.94)', 'scale(1)'] },
        { type: 'spring', visualDuration: 0.3, bounce: 0.25 },
      )
      await new Promise<void>((r) => {
        timers.push(window.setTimeout(r, 250))
      })
      if (cancelled) return

      animate(
        dot,
        { transform: ['scaleX(0)', 'scaleX(1)'] },
        { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
      )
      bravo.classList.add('rg-bravo-shine')

      await new Promise<void>((r) => {
        timers.push(window.setTimeout(r, 500))
      })
      if (cancelled) return

      animate(
        statsEl,
        { opacity: [0, 1], transform: ['translateY(8px)', 'translateY(0)'] },
        { duration: 0.3, ease: [0.23, 1, 0.32, 1] },
      )
    }

    void run()

    return () => {
      cancelled = true
      for (const id of timers) window.clearTimeout(id)
      bravo.classList.remove('rg-bravo-shine')
    }
  }, [reduced])

  return (
    <div
      className="fixed inset-0 z-[9999] flex h-[100dvh] w-screen flex-col bg-[#0B0B0D]"
      role="dialog"
      aria-modal="true"
      aria-label="Séance terminée"
      data-rg-bravo-shine
      data-rg-motion={reduced ? 'reduced' : 'on'}
    >
      <div
        className="flex flex-1 flex-col items-center justify-center px-6 text-center"
        style={{ paddingTop: 'max(1.25rem, env(safe-area-inset-top))' }}
      >
        <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#ACB4BA]">
          Séance terminée
        </p>
        <h1
          ref={bravoRef}
          className="rg-bravo-title mt-3.5 text-[64px] font-extrabold leading-[1.1] tracking-[-0.03em] text-white"
          style={{ opacity: 0 }}
        >
          Bravo&nbsp;!
        </h1>
        <span
          ref={dotRef}
          className="mt-4 block h-1 w-11 rounded-sm bg-[#ff0702]"
          style={{ transform: 'scaleX(0)', transformOrigin: 'center' }}
          aria-hidden
        />
        <div
          ref={statsRef}
          className="mt-8 flex flex-wrap items-stretch justify-center gap-3"
          style={{ opacity: 0 }}
        >
          <div className="min-w-[100px] rounded-[18px] border border-white/10 bg-[#1d1f20] px-[18px] py-3.5">
            <b className="block text-[20px] font-bold tabular-nums text-white">
              {Math.round(stats.volumeKg).toLocaleString('fr-FR')}
            </b>
            <span className="text-[12px] text-[#ACB4BA]">kg volume</span>
          </div>
          <div className="min-w-[100px] rounded-[18px] border border-white/10 bg-[#1d1f20] px-[18px] py-3.5">
            <b className="block text-[20px] font-bold tabular-nums text-white">
              {stats.durationMin}&nbsp;min
            </b>
            <span className="text-[12px] text-[#ACB4BA]">durée</span>
          </div>
          {stats.prCount > 0 ? (
            <div className="min-w-[100px] rounded-[18px] border border-white/10 bg-[#1d1f20] px-[18px] py-3.5">
              <b className="block text-[20px] font-bold tabular-nums text-[#ff0702]">
                +{stats.prCount}
              </b>
              <span className="text-[12px] text-[#ACB4BA]">PR</span>
            </div>
          ) : (
            <div className="min-w-[100px] rounded-[18px] border border-white/10 bg-[#1d1f20] px-[18px] py-3.5">
              <b className="block truncate text-[16px] font-bold text-white">{stats.title}</b>
              <span className="text-[12px] text-[#ACB4BA]">séance</span>
            </div>
          )}
        </div>
      </div>

      <div
        className="px-6"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onContinue}
          className="btn-brand ios-press w-full rounded-2xl py-3.5 text-[15px] font-semibold text-white"
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
