import { Sunrise, CalendarCheck, Crown, Medal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface BadgeItem {
  icon: LucideIcon
  name: string
  description: string
  gradient: string
  iconColor: string
}

const BADGES: BadgeItem[] = [
  {
    icon: Sunrise,
    name: 'Lève-tôt',
    description: 'Séance avant 6h',
    gradient: 'from-orange-500/20 to-amber-600/10',
    iconColor: 'text-orange-400',
  },
  {
    icon: CalendarCheck,
    name: 'Régularité',
    description: '7 jours d\'affilée',
    gradient: 'from-neon-blue/20 to-cyan-600/10',
    iconColor: 'text-neon-blue',
  },
  {
    icon: Crown,
    name: 'Centurion',
    description: '100 séances validées',
    gradient: 'from-yellow-500/20 to-amber-500/10',
    iconColor: 'text-yellow-400',
  },
  {
    icon: Medal,
    name: 'PR Hunter',
    description: '3 records battus',
    gradient: 'from-neon-green/20 to-emerald-600/10',
    iconColor: 'text-neon-green',
  },
]

export function BadgeShowcase() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
          Hauts Faits
        </h3>
        <span className="text-[10px] font-semibold text-neon-purple">
          {BADGES.length} / 12 débloqués
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BADGES.map(({ icon: Icon, name, description, gradient, iconColor }) => (
          <article
            key={name}
            className={`relative overflow-hidden rounded-xl border border-white/5 bg-gradient-to-br ${gradient} p-4`}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/30">
                <Icon className={`h-5 w-5 ${iconColor}`} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white">{name}</p>
                <p className="mt-0.5 text-xs text-slate-400">{description}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
