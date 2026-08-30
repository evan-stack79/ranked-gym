import type { TodayWorkoutPlan } from '../../utils/todayWorkout'

interface TodayWorkoutCardProps {
  workout: TodayWorkoutPlan | null
  onStart: () => void
  onOpenNotebook: () => void
}

function secondaryLine(workout: TodayWorkoutPlan | null): string {
  if (!workout) return 'Pas de séance prévue'
  if (workout.canStart) {
    const countLabel = `${workout.exerciseCount} exercice${workout.exerciseCount > 1 ? 's' : ''}`
    return `${workout.title} · ${countLabel}`
  }
  return `${workout.title} · Séance planifiée`
}

const secondaryButtonClass =
  'ios-press min-h-11 shrink-0 rounded-2xl border border-[#FF2B2B]/20 bg-white/5 px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0C0E]'

const primaryButtonClass =
  'btn-brand ios-press min-h-11 shrink-0 rounded-2xl border border-white/15 px-4 py-2.5 text-[14px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2B2B]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0C0C0E]'

/**
 * Accueil — carte entraînement compacte (alignée Nutrition / Sommeil).
 */
export function TodayWorkoutCard({ workout, onStart, onOpenNotebook }: TodayWorkoutCardProps) {
  const summary = secondaryLine(workout)

  return (
    <section className="glass-card rounded-2xl p-4" aria-label="Entraînement">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-[#8E8E93]">Entraînement</p>
          <p className="mt-1 text-[15px] font-semibold leading-snug text-white">{summary}</p>
        </div>

        {workout?.canStart ? (
          <button
            type="button"
            onClick={onStart}
            aria-label="Démarrer la séance"
            className={primaryButtonClass}
          >
            Démarrer
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenNotebook}
            aria-label={workout ? 'Ouvrir Train' : 'Ouvrir mon carnet'}
            className={secondaryButtonClass}
          >
            {workout ? 'Ouvrir Train' : 'Ouvrir mon carnet'}
          </button>
        )}
      </div>
    </section>
  )
}
