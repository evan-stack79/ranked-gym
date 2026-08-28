import { Dumbbell, NotebookPen, Play } from 'lucide-react'
import type { TodayWorkoutPlan } from '../../utils/todayWorkout'
import { NeonButton } from '../ui/NeonButton'
import { IconBadge } from '../ui/IconBadge'

interface TodayWorkoutCardProps {
  workout: TodayWorkoutPlan | null
  onStart: () => void
  onOpenNotebook: () => void
}

/**
 * Accueil — bloc entraînement minimal (pas d’écran de programmation).
 */
export function TodayWorkoutCard({ workout, onStart, onOpenNotebook }: TodayWorkoutCardProps) {
  if (!workout) {
    return (
      <section className="glass-card rounded-2xl p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <IconBadge icon={Dumbbell} variant="crimson" size="sm" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Entraînement
          </p>
        </div>
        <p className="text-[17px] font-semibold text-white">Aucune séance aujourd&apos;hui</p>
        <p className="mt-1 text-[13px] text-[#8E8E93]">
          Ouvre ton carnet pour créer ou modifier ton programme.
        </p>
        <button
          type="button"
          onClick={onOpenNotebook}
          className="ios-press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-[14px] font-semibold text-white"
        >
          <NotebookPen className="h-4 w-4" />
          Ouvrir mon carnet
        </button>
      </section>
    )
  }

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-[#FF2B2B]/35 p-5"
      style={{
        background:
          'radial-gradient(ellipse 90% 80% at 10% 0%, rgb(255 43 43 / 0.32) 0%, transparent 55%), radial-gradient(ellipse 60% 50% at 100% 100%, rgb(255 159 10 / 0.14) 0%, transparent 50%), rgb(28 28 30 / 0.95)',
        boxShadow:
          'inset 0 1px 0 rgb(255 255 255 / 0.1), 0 0 40px rgb(255 43 43 / 0.12)',
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full blur-3xl"
        style={{ background: `radial-gradient(circle, ${workout.accent}55 0%, transparent 70%)` }}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="ios-label">Entraînement</p>
          <h2 className="mt-1 text-[22px] font-black tracking-tight text-white">{workout.title}</h2>
          <p className="mt-1 text-[15px] font-medium text-[#FF9F0A]">
            {workout.canStart
              ? `${workout.exerciseCount} exercice${workout.exerciseCount > 1 ? 's' : ''}`
              : 'Séance planifiée'}
          </p>
        </div>
        <IconBadge icon={Dumbbell} variant="crimson" />
      </div>

      <div className="relative mt-5">
        {workout.canStart ? (
          <NeonButton onClick={onStart} variant="primary" className="py-3.5 text-[16px]">
            <span className="flex items-center justify-center gap-2 font-bold">
              <Play className="h-5 w-5 fill-current" />
              Démarrer
            </span>
          </NeonButton>
        ) : (
          <button
            type="button"
            onClick={onOpenNotebook}
            className="ios-press flex w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/5 px-4 py-3.5 text-[16px] font-semibold text-white"
          >
            <NotebookPen className="h-5 w-5" />
            Ouvrir Train
          </button>
        )}
      </div>
    </section>
  )
}
