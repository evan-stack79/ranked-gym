import { useRestTimerContext } from '../../context/RestTimerContext'

/** Compte à rebours MM:SS — 01:30, 00:47, 00:30, 00:05. */
export function formatRecoveryClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
}

/** Durée totale — « 1 min 30 », « 1 min 45 », « 45 s ». */
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
 * Voile uniforme + fondu noir doux (pas de carte) + glow radial bas-centre.
 * Label = durée totale (suit +15 s). Source : RestTimerContext / endsAt.
 */
export function RecoveryTimerPanel() {
  const rest = useRestTimerContext()

  if (!rest.state.active && !rest.state.finished) return null

  const totalSec = Math.max(1, rest.state.totalSec)
  const remaining = rest.state.finished ? 0 : rest.state.remainingSec
  const durationLabel = formatRecoveryDurationLabel(totalSec)

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col"
      data-recovery-timer
      data-recovery-overlay
      role="timer"
      aria-label={`Récupération ${formatRecoveryClock(remaining)}`}
    >
      {/* Voile noir uniforme — séance encore lisible en haut */}
      <div
        className="pointer-events-none absolute inset-0 bg-black/45"
        aria-hidden="true"
        data-recovery-veil
      />

      {/*
        Fondu noir : opaque sous le chrono (rien ne traverse),
        transition douce vers le haut (pas de bord de carte).
      */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[68%]"
        aria-hidden="true"
        data-recovery-fade
        style={{
          background:
            'linear-gradient(to top, #000 0%, #000 55%, rgba(0,0,0,0.92) 70%, rgba(0,0,0,0.45) 88%, transparent 100%)',
        }}
      />

      {/*
        Glow rouge : ellipse centrée SOUS le bas d’écran → seule la queue douce
        est visible, aucune bande / ligne de coupure.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]"
        aria-hidden="true"
        data-recovery-glow
        style={{
          background:
            'radial-gradient(ellipse 170% 110% at 50% 118%, rgba(255,43,43,0.42) 0%, rgba(255,43,43,0.18) 34%, rgba(255,43,43,0.06) 55%, transparent 72%)',
        }}
      />

      {/* Bloc chrono remonté + safe area */}
      <div
        className="pointer-events-auto relative z-10 mt-auto flex flex-col items-center px-6"
        data-recovery-controls
        style={{
          marginBottom: 'max(2.5rem, calc(env(safe-area-inset-bottom, 0px) + 1.1rem + 7vh))',
          paddingTop: '0.5rem',
          paddingBottom: '0.35rem',
        }}
      >
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
