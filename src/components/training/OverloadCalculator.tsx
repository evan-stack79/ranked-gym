import { useState } from 'react'
import { Calculator, Sparkles, TrendingUp } from 'lucide-react'
import {
  buildOverloadAdvice,
  relativeStrength,
  type OverloadAdvice,
} from '../../utils/strength'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'
import { IconBadge } from '../ui/IconBadge'

const TONE_STYLES: Record<
  OverloadAdvice['tone'],
  { border: string; bg: string; accent: string; glow: string }
> = {
  up: {
    border: 'border-[#30D158]/40',
    bg: 'bg-[#30D158]/12',
    accent: 'text-[#30D158]',
    glow: '#30D158',
  },
  ok: {
    border: 'border-[#00B4FF]/40',
    bg: 'bg-[#00B4FF]/12',
    accent: 'text-[#64D2FF]',
    glow: '#00B4FF',
  },
  down: {
    border: 'border-[#FF9F0A]/40',
    bg: 'bg-[#FF9F0A]/12',
    accent: 'text-[#FF9F0A]',
    glow: '#FF9F0A',
  },
}

interface OverloadCalculatorProps {
  /** Body weight from Nutri profile — same source of truth */
  bodyWeightKg: number
  goalLabel: string
}

export function OverloadCalculator({ bodyWeightKg, goalLabel }: OverloadCalculatorProps) {
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [reps, setReps] = useState<number | null>(null)
  const [result, setResult] = useState<OverloadAdvice | null>(null)

  const canCalculate = weightKg != null && weightKg > 0 && reps != null && reps > 0

  const handleCalculate = () => {
    if (!canCalculate || weightKg == null || reps == null) return
    setResult(buildOverloadAdvice(weightKg, Math.round(reps)))
  }

  const tone = result ? TONE_STYLES[result.tone] : null
  const ratio =
    result && bodyWeightKg > 0 ? relativeStrength(result.oneRmKg, bodyWeightKg) : null

  return (
    <section className="space-y-3">
      <div className="px-1">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
          Progression
        </p>
        <h2 className="text-[20px] font-bold text-white">Calculateur de Surcharge</h2>
        <p className="mt-1 text-[12px] text-[#AEAEB2]">
          Profil Nutri : {bodyWeightKg} kg · objectif {goalLabel}. Même données partout.
        </p>
      </div>

      <div
        className="relative overflow-hidden rounded-3xl border border-white/10 p-4"
        style={{
          background:
            'radial-gradient(ellipse 90% 70% at 100% 0%, #FF2B2B33 0%, transparent 55%), #1C1C1E',
          boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
        }}
      >
        <div className="mb-4 flex items-center gap-3">
          <IconBadge icon={Calculator} variant="crimson" size="md" />
          <div>
            <p className="text-[15px] font-semibold text-white">Force & surcharge</p>
            <p className="text-[11px] text-[#8E8E93]">Charge barre × reps → 1RM Epley</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
              Poids barre (kg)
            </span>
            <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
              <ClearableNumberInput
                value={weightKg}
                onChange={setWeightKg}
                min={0.5}
                max={500}
                step={0.5}
                required={false}
                placeholder="60"
                aria-label="Poids utilisé en kg"
                className="w-full bg-transparent text-[28px] font-bold tracking-tight text-white outline-none placeholder:text-[#636366]"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#636366]">
              Répétitions
            </span>
            <div className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
              <ClearableNumberInput
                value={reps}
                onChange={setReps}
                min={1}
                max={50}
                step={1}
                required={false}
                placeholder="20"
                aria-label="Nombre de répétitions"
                className="w-full bg-transparent text-[28px] font-bold tracking-tight text-white outline-none placeholder:text-[#636366]"
              />
            </div>
          </label>
        </div>

        <button
          type="button"
          disabled={!canCalculate}
          onClick={handleCalculate}
          className="btn-brand ios-press mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-[15px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <TrendingUp className="h-4 w-4" />
          Calculer ma progression
        </button>

        {result && tone && (
          <div
            className={`mt-4 space-y-3 rounded-2xl border px-4 py-3.5 ${tone.border} ${tone.bg}`}
            style={{
              boxShadow: `0 0 24px ${tone.glow}22`,
            }}
          >
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                  1RM estimé (Epley)
                </p>
                <p className="mt-0.5 text-[32px] font-black tracking-tight text-white">
                  {result.oneRmKg}
                  <span className="ml-1 text-[16px] font-semibold text-[#AEAEB2]">kg</span>
                </p>
                {ratio != null && ratio > 0 && (
                  <p className="mt-0.5 text-[11px] text-[#8E8E93]">
                    {ratio}× ton poids de corps ({bodyWeightKg} kg)
                  </p>
                )}
              </div>
              {result.nextWeightKg != null && (
                <div className="text-right">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8E8E93]">
                    Prochaine charge
                  </p>
                  <p className={`text-[22px] font-black ${tone.accent}`}>
                    {result.nextWeightKg} kg
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 border-t border-white/10 pt-3">
              <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${tone.accent}`} />
              <div>
                <p className={`text-[14px] font-bold ${tone.accent}`}>{result.headline}</p>
                <p className="mt-1 text-[13px] leading-snug text-[#E5E5EA]">{result.message}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
