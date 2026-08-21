import { HeartPulse, Sparkles } from 'lucide-react'
import type { CalorieProfile } from '../../types/nutrition'
import { GOAL_LABELS } from '../../utils/calories'
import { computeWeightPace } from '../../utils/weightPace'

interface WeightPaceCardProps {
  profile: CalorieProfile
}

export function WeightPaceCard({ profile }: WeightPaceCardProps) {
  const pace = computeWeightPace({
    currentKg: profile.weightKg,
    goalKg: profile.goalWeightKg,
    morphology: profile.morphology,
    goal: profile.goal,
    weeklyPaceKg: profile.weeklyPaceKg,
  })

  return (
    <section
      className="rounded-3xl border border-white/10 p-4"
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 0% 0%, rgb(255 159 10 / 0.18) 0%, transparent 55%), rgb(28 28 30 / 0.92)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
      }}
    >
      <div className="mb-3 flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-[#FF9F0A]" />
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Rythme {GOAL_LABELS[pace.goal]}
          </p>
          <h3 className="text-[17px] font-bold text-white">Objectif poids · ton choix</h3>
        </div>
      </div>

      <p className="text-[22px] font-black tracking-tight text-white">{pace.headline}</p>
      {pace.estimatedWeeks != null && (
        <p className="mt-1 text-[13px] text-[#AEAEB2]">
          {profile.weightKg} → {profile.goalWeightKg} kg · ~{pace.estimatedWeeks} semaines à{' '}
          {Math.abs(pace.weeklyKg).toFixed(1)} kg/sem.
        </p>
      )}

      <div className="mt-3 space-y-2">
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
          <p className="text-[11px] font-semibold text-[#30D158]">Santé</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#AEAEB2]">{pace.healthTip}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">
          <p className="flex items-center gap-1 text-[11px] font-semibold text-[#64D2FF]">
            <Sparkles className="h-3 w-3" />
            Esthétique
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-[#AEAEB2]">{pace.aestheticTip}</p>
        </div>
      </div>
    </section>
  )
}
