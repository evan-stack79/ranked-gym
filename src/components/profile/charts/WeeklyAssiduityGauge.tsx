interface WeeklyAssiduityGaugeProps {
  completed?: number
  target?: number
  className?: string
}

export function WeeklyAssiduityGauge({
  completed = 3,
  target = 4,
  className = '',
}: WeeklyAssiduityGaugeProps) {
  const slots = Array.from({ length: target }, (_, i) => i < completed)

  return (
    <div className={`glass-card rounded-2xl p-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#FF907F]">
            Assiduité
          </p>
          <p className="mt-1 text-[15px] font-semibold text-white">
            Semaine en cours :{' '}
            <span className="text-[#FF0702]">
              {completed}/{target}
            </span>{' '}
            séances complétées
          </p>
        </div>
        <span className="rounded-full border border-[#FF0702]/30 bg-[#FF0702]/12 px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#FF907F]">
          {Math.round((completed / Math.max(target, 1)) * 100)}%
        </span>
      </div>

      <div className="mt-4 flex gap-2" role="list" aria-label={`${completed} séances sur ${target}`}>
        {slots.map((lit, i) => (
          <div
            key={i}
            role="listitem"
            aria-label={lit ? `Séance ${i + 1} complétée` : `Séance ${i + 1} à faire`}
            className={`h-3 flex-1 rounded-md transition-colors ${
              lit
                ? 'bg-gradient-to-r from-[#FF0702] to-[#FF907F] shadow-[0_0_12px_rgb(255_7_2_/0.45)]'
                : 'border border-[#25282A] bg-[#1D1F20]'
            }`}
          />
        ))}
      </div>

      <p className="mt-3 text-[12px] text-[#717C83]">
        Objectif hebdo : {target} séances · {target - completed > 0 ? `Encore ${target - completed} à valider` : 'Semaine bouclée'}
      </p>
    </div>
  )
}
