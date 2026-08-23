import { useCallback, useEffect, useState } from 'react'
import { Sunrise, CalendarCheck, Crown, Medal, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { IconBadge } from '../ui/IconBadge'
import { useAuth } from '../../context/AuthContext'
import { RADAR_REGULARITY_LABEL } from '../../constants/radarLabels'
import {
  loadProfileStats,
  type ProfileAchievementId,
} from '../../services/profileStats'

interface BadgeDef {
  id: ProfileAchievementId
  icon: LucideIcon
  name: string
  description: string
  variant: 'blue' | 'orange' | 'green' | 'white' | 'crimson' | 'violet'
}

const BADGES: BadgeDef[] = [
  {
    id: 'early_bird',
    icon: Sunrise,
    name: 'Lève-tôt',
    description: 'Séance avant 6h',
    variant: 'orange',
  },
  {
    id: 'consistency',
    icon: CalendarCheck,
    name: RADAR_REGULARITY_LABEL,
    description: '7 jours d’affilée',
    variant: 'crimson',
  },
  {
    id: 'centurion',
    icon: Crown,
    name: 'Centurion',
    description: '100 séances',
    variant: 'violet',
  },
  {
    id: 'pr_hunter',
    icon: Medal,
    name: 'PR Hunter',
    description: '3 exercices avec PR',
    variant: 'blue',
  },
]

const TOTAL_BADGES = 12

export function BadgeShowcase() {
  const { user, profile, isAuthenticated } = useAuth()
  const [unlocked, setUnlocked] = useState<Record<ProfileAchievementId, boolean>>({
    early_bird: false,
    consistency: false,
    centurion: false,
    pr_hunter: false,
  })

  const refresh = useCallback(() => {
    if (!isAuthenticated) {
      setUnlocked({
        early_bird: false,
        consistency: false,
        centurion: false,
        pr_hunter: false,
      })
      return
    }
    void loadProfileStats({
      userId: user?.id,
      streakDays: profile?.current_streak ?? 0,
    }).then((s) => setUnlocked(s.unlocked))
  }, [isAuthenticated, user?.id, profile?.current_streak])

  useEffect(() => {
    refresh()
    window.addEventListener('ranked-gym:backup-restored', refresh)
    return () => window.removeEventListener('ranked-gym:backup-restored', refresh)
  }, [refresh])

  const unlockedCount = BADGES.filter((b) => unlocked[b.id]).length

  return (
    <section>
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="ios-label">Hauts faits</h3>
        <span className="text-[13px] tabular-nums text-[#8E8E93]">
          {unlockedCount} / {TOTAL_BADGES}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {BADGES.map((badge) => {
          const isOn = unlocked[badge.id]
          return (
            <article
              key={badge.id}
              className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 ${
                isOn
                  ? 'badge-unlocked border-white/14'
                  : 'border-white/8 bg-white/[0.03] opacity-55'
              }`}
              style={
                isOn
                  ? {
                      background: 'rgb(255 255 255 / 0.06)',
                      boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.1)',
                    }
                  : undefined
              }
            >
              {!isOn ? (
                <span
                  className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/35 text-[#8E8E93]"
                  aria-hidden
                >
                  <Lock className="h-3 w-3" strokeWidth={2.25} />
                </span>
              ) : null}

              <div className={isOn ? '' : 'grayscale'}>
                <IconBadge
                  icon={badge.icon}
                  variant={isOn ? badge.variant : 'white'}
                  size="md"
                />
              </div>
              <p
                className={`mt-3 font-semibold tracking-tight ${
                  isOn ? 'text-white' : 'text-[#AEAEB2]'
                }`}
              >
                {badge.name}
              </p>
              <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">{badge.description}</p>
              <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#636366]">
                {isOn ? 'Débloqué' : 'Verrouillé'}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
