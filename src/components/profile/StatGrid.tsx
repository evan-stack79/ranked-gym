import type { LucideIcon } from 'lucide-react'
import { Flame, Dumbbell, Trophy } from 'lucide-react'
import { Sparkline } from '../ui/Sparkline'
import { ActivityRings } from '../ui/ActivityRings'
import { IconBadge } from '../ui/IconBadge'

interface StatItem {
  icon: LucideIcon
  label: string
  value: string
  visual: 'rings' | 'sparkline' | 'bar'
  ringValues?: [number, number, number]
  sparkPoints?: number[]
  barProgress?: number
}

const STATS: StatItem[] = [
  {
    icon: Flame,
    label: 'Série',
    value: '4 jours',
    visual: 'rings',
    ringValues: [0.72, 0.55, 0.4],
  },
  {
    icon: Dumbbell,
    label: 'Séances',
    value: '128',
    visual: 'sparkline',
    sparkPoints: [12, 18, 15, 22, 19, 28, 32, 26, 35, 38],
  },
  {
    icon: Trophy,
    label: 'PR',
    value: '100 kg',
    visual: 'bar',
    barProgress: 0.82,
  },
]

function StatVisual({ stat }: { stat: StatItem }) {
  if (stat.visual === 'rings' && stat.ringValues) {
    return <ActivityRings values={stat.ringValues} size={34} />
  }
  if (stat.visual === 'sparkline' && stat.sparkPoints) {
    return <Sparkline points={stat.sparkPoints} />
  }
  if (stat.visual === 'bar' && stat.barProgress != null) {
    return (
      <div className="flex h-9 w-9 items-center justify-center">
        <svg viewBox="0 0 36 36" className="h-9 w-9" aria-hidden="true">
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="rgb(255 255 255 / 0.08)"
            strokeWidth="3"
          />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="#FF9F0A"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 14}
            strokeDashoffset={2 * Math.PI * 14 * (1 - stat.barProgress)}
            transform="rotate(-90 18 18)"
          />
        </svg>
      </div>
    )
  }
  return null
}

export function StatGrid() {
  return (
    <section>
      <h3 className="ios-label mb-3 px-1">Statistiques</h3>
      <div className="grid grid-cols-3 gap-3">
        {STATS.map((stat) => (
          <div key={stat.label} className="glass-card rounded-2xl p-3.5">
            <div className="mb-3 flex items-start justify-between gap-1">
              <IconBadge
                icon={stat.icon}
                variant={stat.label === 'Série' ? 'orange' : stat.label === 'PR' ? 'green' : 'blue'}
                size="sm"
              />
              <StatVisual stat={stat} />
            </div>
            <p className="text-[18px] font-semibold tracking-tight text-white">{stat.value}</p>
            <p className="mt-1 text-[12px] text-[#8E8E93]">{stat.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
