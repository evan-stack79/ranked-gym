import { Sunrise, CalendarCheck, Crown, Medal } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface BadgeItem {
  icon: LucideIcon
  name: string
  description: string
}

const BADGES: BadgeItem[] = [
  { icon: Sunrise, name: 'Lève-tôt', description: 'Séance avant 6h' },
  { icon: CalendarCheck, name: 'Régularité', description: '7 jours d\'affilée' },
  { icon: Crown, name: 'Centurion', description: '100 séances' },
  { icon: Medal, name: 'PR Hunter', description: '3 records battus' },
]

export function BadgeShowcase() {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="ios-label">Hauts faits</h3>
        <span className="text-[13px] text-[#8E8E93]">{BADGES.length} / 12</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BADGES.map(({ icon: Icon, name, description }) => (
          <article key={name} className="rounded-2xl bg-ios-surface p-4">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-ios-inset">
              <Icon className="h-5 w-5 text-[#0A84FF]" strokeWidth={1.75} />
            </div>
            <p className="font-semibold tracking-tight text-white">{name}</p>
            <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">{description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
