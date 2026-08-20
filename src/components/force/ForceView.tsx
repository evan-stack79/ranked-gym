import { useEffect, useMemo, useState } from 'react'
import { Gauge, Sparkles, Swords, Zap } from 'lucide-react'
import {
  getTrainingState,
  saveTrainingState,
  applyForceProgression,
} from '../../services/trainingStorage'
import { getCalorieProfile } from '../../services/nutritionStorage'
import {
  arenaBand,
  buildForceRows,
  totalArenaScore,
} from '../../utils/forceArena'
import { IconBadge } from '../ui/IconBadge'

export function ForceView() {
  const [tick, setTick] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const onRestored = () => setTick((t) => t + 1)
    window.addEventListener('ranked-gym:backup-restored', onRestored)
    return () => window.removeEventListener('ranked-gym:backup-restored', onRestored)
  }, [])

  const profile = useMemo(() => getCalorieProfile(), [tick])
  const training = useMemo(() => getTrainingState(), [tick])

  const rows = useMemo(
    () => buildForceRows(training.routines, profile.weightKg),
    [training.routines, profile.weightKg],
  )
  const score = totalArenaScore(rows)
  const band = arenaBand(score)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }

  const handleAutoProgress = () => {
    const next = applyForceProgression(profile.weightKg)
    saveTrainingState(next)
    setTick((t) => t + 1)
    showToast('Charges mises à jour selon Facile / OK / Dur — prêtes pour la prochaine séance')
  }

  return (
    <div className="flex flex-col gap-7 pb-4">
      <header className="relative ios-fade-up">
        <div
          className="pointer-events-none absolute -left-6 -top-4 h-28 w-40 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, #BF5AF244 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div className="relative">
          <div className="mb-2 flex items-center gap-2">
            <IconBadge icon={Gauge} variant="violet" size="sm" />
            <span className="rounded-full border border-[#BF5AF2]/30 bg-[#BF5AF2]/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#D6A8FF]">
              Force
            </span>
          </div>
          <h1 className="text-[34px] font-bold tracking-tight text-white">Calculateur</h1>
          <p className="mt-2 text-[17px] text-[#8E8E93]">
            Tes séances Train → force relative, score Arena, progression auto.
          </p>
        </div>
      </header>

      <section
        className="rounded-3xl border border-white/10 p-5"
        style={{
          background:
            'radial-gradient(ellipse 90% 80% at 10% 0%, rgb(191 90 242 / 0.25) 0%, transparent 55%), rgb(28 28 30 / 0.95)',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
              Arena Score
            </p>
            <p className="mt-1 text-[42px] font-black tracking-tight text-white">{score}</p>
            <p className="text-[14px] font-semibold text-[#D6A8FF]">{band.label}</p>
          </div>
          <Swords className="h-8 w-8 text-[#BF5AF2]" />
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-[#AEAEB2]">{band.hint}</p>
        <p className="mt-2 text-[11px] text-[#636366]">
          Score basé sur force × poids de corps (équitable). Tout le monde peut grimper — pas de
          gap injuste entre débutant et confirmé.
        </p>
      </section>

      <button
        type="button"
        onClick={handleAutoProgress}
        disabled={rows.length === 0}
        className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        <Zap className="h-4 w-4" />
        Préparer la prochaine séance (auto)
      </button>
      <p className="px-1 text-center text-[11px] text-[#8E8E93]">
        Facile → + charge · OK → petit + · Dur → on réduit. Puis rouvre le focus dans Train.
      </p>

      {rows.length === 0 ? (
        <div className="glass-card rounded-3xl px-5 py-10 text-center">
          <Sparkles className="mx-auto h-7 w-7 text-[#8E8E93]" />
          <p className="mt-2 text-[15px] font-semibold text-white">Pas encore de séances</p>
          <p className="mt-1 text-[12px] text-[#8E8E93]">
            Va dans Train, choisis Upper / Jambes / Pecs, note tes séries, sauve — elles
            apparaissent ici.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={`${row.routineId}-${row.exerciseName}`}
              className="glass-card rounded-2xl p-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{row.exerciseName}</p>
                  <p className="text-[11px] text-[#8E8E93]">{row.routineLabel}</p>
                </div>
                <span className="shrink-0 rounded-full bg-[#BF5AF2]/20 px-2 py-0.5 text-[11px] font-bold text-[#D6A8FF]">
                  {row.score}
                </span>
              </div>
              <p className="mt-2 text-[13px] text-[#AEAEB2]">
                1RM ~<span className="font-semibold text-white">{row.oneRm} kg</span>
                {' · '}
                {row.ratio}× BW
                {' · '}
                dernier ressenti :{' '}
                <span className="text-white">
                  {row.lastDifficulty === 'easy'
                    ? 'Facile'
                    : row.lastDifficulty === 'hard'
                      ? 'Dur'
                      : 'OK'}
                </span>
              </p>
              {row.suggestedNextKg != null && (
                <p className="mt-1 text-[12px] text-[#30D158]">
                  Prochaine → ~{row.suggestedNextKg} kg · {row.tip}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 max-w-[90%] -translate-x-1/2 rounded-full border border-white/10 bg-[#2C2C2E] px-4 py-2 text-center text-[13px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
