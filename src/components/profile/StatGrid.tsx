import type { LucideIcon } from 'lucide-react'
import { Flame, Dumbbell, Trophy } from 'lucide-react'

interface StatItem {
  icon: LucideIcon
  label: string
  value: string
  accent: string
}

const STATS: StatItem[] = [
  {
    icon: Flame,
    label: 'Série',
    value: '🔥 4 jours',
    accent: 'text-orange-400',
  },
  {
    icon: Dumbbell,
    label: 'Séances totales',
    value: '128',
    accent: 'text-neon-blue',
  },
  {
    icon: Trophy,
    label: 'PR',
    value: 'Bench 100kg',
    accent: 'text-neon-green',
  },
]

export function StatGrid() {
  return (
    <section>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
        Statistiques RPG
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {STATS.map(({ icon: Icon, label, value, accent }) => (
          <div
            key={label}
            className="group relative overflow-hidden rounded-xl border border-white/5 bg-anthracite p-3 text-center transition-colors hover:border-white/10"
          >
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <Icon className={`mx-auto mb-2 h-5 w-5 ${accent}`} />
            <p className="text-sm font-black leading-tight text-white">{value}</p>
            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
              {label}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
