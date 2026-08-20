import { Sunrise, CalendarCheck, Crown, Medal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { IconBadge } from '../ui/IconBadge'

interface BadgeItem {
  icon: LucideIcon
  name: string
  description: string
  variant: 'blue' | 'orange' | 'green' | 'white' | 'crimson' | 'violet'
}

const BADGES: BadgeItem[] = [
  { icon: Sunrise, name: 'Lève-tôt', description: 'Séance avant 6h', variant: 'orange' },
  { icon: CalendarCheck, name: 'Régularité', description: '7 jours d\'affilée', variant: 'crimson' },
  { icon: Crown, name: 'Centurion', description: '100 séances', variant: 'violet' },
  { icon: Medal, name: 'PR Hunter', description: '3 records battus', variant: 'blue' },
]

export function BadgeShowcase() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="ios-label">Hauts faits</h3>
        <span className="text-[13px] text-[#8E8E93]">{BADGES.length} / 12</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BADGES.map(({ icon, name, description, variant }) => (
          <article key={name} className="glass-card rounded-2xl p-4">
            <IconBadge icon={icon} variant={variant} size="md" />
            <p className="mt-3 font-semibold tracking-tight text-white">{name}</p>
            <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">{description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
