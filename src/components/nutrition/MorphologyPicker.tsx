import type { BodyMorphology } from '../../types/nutrition'
import {
  MORPHOLOGY_APP_TIP,
  MORPHOLOGY_HINTS,
  MORPHOLOGY_HOW_TO,
  MORPHOLOGY_LABELS,
  MORPHOLOGY_ORDER,
  MORPHOLOGY_SHORT,
} from '../../utils/morphology'

interface MorphologyPickerProps {
  value: BodyMorphology
  onChange: (value: BodyMorphology) => void
  compact?: boolean
}

export function MorphologyPicker({ value, onChange, compact = false }: MorphologyPickerProps) {
  return (
    <div className="space-y-3">
      {!compact && (
        <div className="rounded-2xl border border-white/10 bg-black/25 px-3.5 py-3">
          <p className="text-[12px] font-semibold text-white">Comment savoir ?</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#AEAEB2]">{MORPHOLOGY_HOW_TO}</p>
        </div>
      )}

      <div className="space-y-2">
        {MORPHOLOGY_ORDER.map((item) => {
          const active = value === item
          return (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              className={`ios-press w-full rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                active
                  ? 'border-[#30D158]/45 bg-[#30D158]/15'
                  : 'border-white/10 bg-black/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`text-[15px] font-semibold ${active ? 'text-white' : 'text-[#AEAEB2]'}`}>
                  {MORPHOLOGY_LABELS[item]}
                </p>
                <span className="text-[11px] font-medium text-[#8E8E93]">{MORPHOLOGY_SHORT[item]}</span>
              </div>
              {active && (
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#AEAEB2]">
                  {MORPHOLOGY_HINTS[item]}
                </p>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-[12px] leading-relaxed text-[#8E8E93]">{MORPHOLOGY_APP_TIP[value]}</p>
    </div>
  )
}
