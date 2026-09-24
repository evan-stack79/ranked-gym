import { useRef } from 'react'
import { useRestTimerContext } from '../../context/RestTimerContext'

/** Compte à rebours MM:SS — 01:30, 00:47, 00:30, 00:05. */
export function formatRecoveryClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** Durée programmée — « 1 min 30 », « 45 s », « 2 min ». */
export function formatRecoveryDurationLabel(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m <= 0) return `${r} s`
  if (r === 0) return m === 1 ? '1 min' : `${m} min`
  return `${m} min ${r}`
}

/**
 * Overlay récupération (maquette Evan).
 * Voile uniforme sur la séance + couche chrono dédiée opaque (rien ne traverse).
 * Glow rouge progressif depuis le bas — pas de carte, pas de barre, pas de bandeau.
 * Source unique : RestTimerContext (endsAt persisté).
 */
export function RecoveryTimerPanel() {
  const rest = useRestTimerContext()
  /** Durée affichée dans le label — figée au démarrage (pas gonflée par +15 s). */
  const programmedSecRef = useRef<number | null>(null)

  if (!rest.state.active && !rest.state.finished) {
    programmedSecRef.current = null
    return null
  }

  if (programmedSecRef.current == null && rest.state.totalSec > 0) {
    programmedSecRef.current = rest.state.totalSec
  }

  const programmedSec = programmedSecRef.current ?? Math.max(1, rest.state.totalSec)
  const remaining = rest.state.finished ? 0 : rest.state.remainingSec
  const durationLabel = formatRecoveryDurationLabel(programmedSec)

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col"
      data-recovery-timer
      data-recovery-overlay
      role="timer"
      aria-label={`Récupération ${formatRecoveryClock(remaining)}`}
    >
      {/* Voile noir uniforme — séance encore lisible (moins sombre qu’opacity 0.28) */}
      <div
        className="pointer-events-none absolute inset-0 bg-black/52"
        aria-hidden="true"
        data-recovery-veil
      />

      {/* Glow rouge progressif (bas → transparent) — pas un rectangle opaque */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%]"
        aria-hidden="true"
        data-recovery-glow
        style={{
          background:
            'linear-gradient(to top, rgba(255,43,43,0.42) 0%, rgba(255,43,43,0.14) 28%, rgba(255,43,43,0.04) 52%, transparent 78%)',
        }}
      />

      {/* Bloc chrono remonté — couche opaque dédiée, rien de la séance ne traverse */}
      <div
        className="pointer-events-auto relative z-10 mt-auto flex flex-col items-center px-6"
        data-recovery-controls
        style={{
          // Remonte le bloc (~8vh) + safe area iPhone sous +15 s
          marginBottom: 'max(2.75rem, calc(env(safe-area-inset-bottom, 0px) + 1.25rem + 8vh))',
          paddingTop: '1.75rem',
          paddingBottom: '0.5rem',
        }}
      >
        {/* Plaque opaque derrière label / chrono / boutons */}
        <div
          className="pointer-events-none absolute inset-x-0 -top-6 bottom-[-0.5rem] -z-10"
          aria-hidden="true"
          data-recovery-plate
          style={{
            background:
              'linear-gradient(to top, #000 0%, #000 72%, rgba(0,0,0,0.92) 88%, rgba(0,0,0,0.55) 100%)',
          }}
        />

        <p className="text-center text-[15px] font-semibold tracking-tight" data-recovery-label>
          <span className="text-[#FF2B2B]">Récupération</span>
          <span className="text-white"> · {durationLabel}</span>
        </p>

        <p
          className="mt-3 text-[76px] font-bold leading-none tracking-tight tabular-nums text-white"
          data-recovery-remaining
        >
          {formatRecoveryClock(remaining)}
        </p>

        <button
          type="button"
          onClick={() => rest.skip()}
          className="ios-press mt-6 flex min-h-12 w-[52%] max-w-[200px] items-center justify-center rounded-full border border-[#FF2B2B] bg-transparent text-[16px] font-semibold text-white"
          data-recovery-resume
        >
          Reprendre
        </button>

        <button
          type="button"
          onClick={() => rest.addSeconds(15)}
          className="ios-press mt-3 min-h-10 px-3 text-[14px] font-medium text-white/80"
          data-recovery-add-15
          aria-label="Ajouter 15 secondes de récupération"
        >
          +15 s
        </button>
      </div>
    </div>
  )
}
