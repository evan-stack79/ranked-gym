/**
 * Gainage : pas de durée cible, texte exact validé, timer simple,
 * aucun record / comparaison.
 */
import { useEffect, useState } from 'react'
import { GAINAGE_HOLD_TEXT } from '../../data/beginnerProgramme'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function formatHold(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function GainageHoldPanel({
  onDone,
}: {
  /** Fin volontaire — aucune perf enregistrée. */
  onDone?: () => void
}) {
  const [running, setRunning] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setElapsedSec((n) => n + 1), 1000)
    return () => window.clearInterval(id)
  }, [running])

  return (
    <div
      className="rounded-3xl border border-white/10 bg-[#141416] p-4"
      data-testid="gainage-hold-panel"
      data-no-record="1"
    >
      <p className="text-[15px] font-semibold text-white">Gainage sur les avant-bras</p>
      <p className="mt-2 text-[14px] leading-relaxed text-[#E5E5EA]">{GAINAGE_HOLD_TEXT}</p>
      <p
        className="mt-4 text-center text-[40px] font-bold tabular-nums text-white"
        data-testid="gainage-hold-timer"
        style={reduced ? undefined : { transition: 'opacity 160ms var(--ease-out, ease-out)' }}
      >
        {formatHold(elapsedSec)}
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          className="btn-brand ios-press min-h-11 flex-1 rounded-2xl text-[15px] font-semibold text-white"
          data-testid="gainage-hold-toggle"
          onClick={() => setRunning((v) => !v)}
        >
          {running ? 'Pause' : elapsedSec > 0 ? 'Reprendre' : 'Démarrer'}
        </button>
        <button
          type="button"
          className="ios-press min-h-11 flex-1 rounded-2xl border border-white/15 bg-white/5 text-[15px] font-semibold text-[#AEAEB2]"
          data-testid="gainage-hold-done"
          onClick={() => {
            setRunning(false)
            onDone?.()
          }}
        >
          Terminé
        </button>
      </div>
    </div>
  )
}
