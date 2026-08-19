import type { LucideIcon } from 'lucide-react'
import { Flame, Dumbbell, Trophy } from 'lucide-react'

interface StatItem {
  icon: LucideIcon
  label: string
  value: string
}

const STATS: StatItem[] = [
  { icon: Flame, label: 'Série', value: '4 jours' },
  { icon: Dumbbell, label: 'Séances', value: '128' },
  { icon: Trophy, label: 'PR', value: '100 kg' },
]

export function StatGrid() {
  return (
    <section>
      <h3 className="ios-label mb-3 px-1">Statistiques</h3>
      <div className="grid grid-cols-3 gap-3">
        {STATS.map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-2xl bg-ios-surface p-4">
            <Icon className="mb-3 h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
            <p className="text-[20px] font-semibold tracking-tight text-white">{value}</p>
            <p className="mt-1 text-[13px] text-[#8E8E93]">{label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
