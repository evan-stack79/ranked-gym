import { Footprints, Link2, Sparkles } from 'lucide-react'
import { ClearableNumberInput } from '../nutrition/ClearableNumberInput'

interface StepsCardProps {
  steps: number
  burnedKcal: number
  bonusKcal: number
  goalLabel: string
  healthLinked: boolean
  onStepsChange: (steps: number) => void
  onConnectHealth: () => void
}

export function StepsCard({
  steps,
  burnedKcal,
  bonusKcal,
  goalLabel,
  healthLinked,
  onStepsChange,
  onConnectHealth,
}: StepsCardProps) {
  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/10 p-5"
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 0% 0%, rgb(0 180 255 / 0.2) 0%, transparent 55%), rgb(28 28 30 / 0.92)',
        boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08)',
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#8E8E93]">
            Aujourd’hui
          </p>
          <h2 className="text-[20px] font-bold text-white">Pas & énergie</h2>
        </div>
        <button
          type="button"
          onClick={onConnectHealth}
          className="ios-press inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-semibold text-[#AEAEB2]"
        >
          <Link2 className="h-3.5 w-3.5" />
          {healthLinked ? 'Santé OK' : 'Lier Santé'}
        </button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="mb-1 flex items-center gap-2 text-[12px] font-semibold text-[#8E8E93]">
          <Footprints className="h-3.5 w-3.5 text-[#64D2FF]" />
          Nombre de pas
        </div>
        <div className="flex items-end gap-2">
          <ClearableNumberInput
            value={steps || null}
            onChange={(v) => onStepsChange(v ?? 0)}
            min={0}
            max={100000}
            step={1}
            required={false}
            placeholder="Ex. 10 000"
            placeholderClassName="pointer-events-none absolute inset-0 flex items-center text-[34px] font-bold tracking-tight text-[#636366]"
            aria-label="Pas du jour"
            className="relative z-[1] w-full bg-transparent text-[34px] font-bold tracking-tight text-white outline-none"
          />
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[5000, 8000, 10000, 12000].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onStepsChange(preset)}
              className={`ios-press rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                steps === preset
                  ? 'border-[#00B4FF]/45 bg-[#00B4FF]/20 text-[#64D2FF]'
                  : 'border-white/10 text-[#8E8E93]'
              }`}
            >
              {preset.toLocaleString('fr-FR')}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-[#30D158]/25 bg-[#30D158]/10 px-3.5 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#30D158]" />
        <p className="text-[12px] leading-relaxed text-[#AEAEB2]">
          ~{burnedKcal} kcal dépensées · objectif <span className="text-white">{goalLabel}</span> →
          on ajoute <span className="font-semibold text-[#30D158]">+{bonusKcal} kcal</span> à
          manger pour rééquilibrer (Nutri se met à jour).
        </p>
      </div>
    </section>
  )
}
