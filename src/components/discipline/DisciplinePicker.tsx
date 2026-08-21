import type { AppDisciplineId } from '../../data/disciplines'
import { APP_DISCIPLINES } from '../../data/disciplines'

interface DisciplinePickerProps {
  value: AppDisciplineId
  onChange: (id: AppDisciplineId) => void
  compact?: boolean
}

export function DisciplinePicker({ value, onChange, compact }: DisciplinePickerProps) {
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {APP_DISCIPLINES.map((d) => {
        const active = d.id === value
        return (
          <button
            key={d.id}
            type="button"
            onClick={() => onChange(d.id)}
            className={`ios-press rounded-2xl border px-3.5 py-3 text-left transition-colors ${
              active
                ? 'border-white/25 text-white'
                : 'border-white/10 bg-black/25 text-[#8E8E93]'
            }`}
            style={
              active
                ? {
                    background: `${d.accent}22`,
                    borderColor: `${d.accent}66`,
                    boxShadow: `inset 0 0 0 1px ${d.accent}33`,
                  }
                : undefined
            }
          >
            <p className="text-[14px] font-semibold text-white">{d.label}</p>
            {!compact && (
              <p className="mt-0.5 text-[11px] text-[#AEAEB2]">{d.spotLabel}</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
