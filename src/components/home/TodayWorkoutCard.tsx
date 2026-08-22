import { Dumbbell, Play } from 'lucide-react'
import type { TodayWorkoutPlan } from '../../utils/todayWorkout'
import { NeonButton } from '../ui/NeonButton'
import { IconBadge } from '../ui/IconBadge'

interface TodayWorkoutCardProps {
  workout: TodayWorkoutPlan
  onStart: () => void
}

export function TodayWorkoutCard({ workout, onStart }: TodayWorkoutCardProps) {
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
          <div className="mb-2 flex items-center gap-2">
            <p className="ios-label">Entraînement du jour</p>
            <span className="rounded-full border border-[#FF2B2B]/30 bg-[#FF2B2B]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#FF6961]">
              {workout.source === 'schedule' ? 'Agenda' : 'Suggestion'}
            </span>
          </div>
          <h2 className="text-[22px] font-black tracking-tight text-white">{workout.title}</h2>
          <p className="mt-1 text-[15px] font-medium text-[#FF9F0A]">{workout.subtitle}</p>
        </div>
        <IconBadge icon={Dumbbell} variant="crimson" />
      </div>

      <div className="relative mt-5">
        <NeonButton onClick={onStart} variant="primary" className="py-3.5 text-[16px]">
          <span className="flex items-center justify-center gap-2 font-bold">
            <Play className="h-5 w-5 fill-current" />
            Démarrer la séance
          </span>
        </NeonButton>
      </div>
    </section>
  )
}
