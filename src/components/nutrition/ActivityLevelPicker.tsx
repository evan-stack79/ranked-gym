import type { ActivityLevel } from '../../types/nutrition'
import {
  ACTIVITY_HINTS,
  ACTIVITY_LABELS,
  ACTIVITY_ORDER,
} from '../../utils/calories'

interface ActivityLevelPickerProps {
  value: ActivityLevel
  onChange: (level: ActivityLevel) => void
}

export function ActivityLevelPicker({ value, onChange }: ActivityLevelPickerProps) {
  return (
    <div className="space-y-2.5">
      <p className="text-[12px] font-semibold text-[#ACB4BA]">Niveau d’activité</p>
      <p className="text-[11px] leading-relaxed text-[#717C83]">
        Choisis ce qui te ressemble aujourd’hui — tu pourras le changer plus tard. L’important, c’est
        d’avancer à ton rythme.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITY_ORDER.map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={`ios-press rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
              value === level
                ? 'border-[#00B4FF]/50 bg-[#00B4FF]/20 text-[#64D2FF]'
                : 'border-white/10 bg-black/20 text-[#ACB4BA]'
            }`}
          >
            {ACTIVITY_LABELS[level]}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3">
        <p className="text-[13px] font-semibold text-white">{ACTIVITY_LABELS[value]}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#ACB4BA]">
          {ACTIVITY_HINTS[value]}
        </p>
      </div>
    </div>
  )
}
