import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Flame, Dumbbell, Trophy, Pencil } from 'lucide-react'
import { Sparkline } from '../ui/Sparkline'
import { ActivityRings } from '../ui/ActivityRings'
import { IconBadge } from '../ui/IconBadge'
import { IosSheet } from '../ui/IosSheet'
import { useAuth } from '../../context/AuthContext'
import {
  loadProfileStats,
  type ExercisePr,
  type ProfileStatsSnapshot,
} from '../../services/profileStats'
import { setPinnedPr } from '../../services/profileStorage'

function streakRings(days: number): [number, number, number] {
  const week = Math.min(1, days / 7)
  const fortnight = Math.min(1, days / 14)
  const month = Math.min(1, days / 30)
  return [week, fortnight, month]
}

function formatStreak(days: number): string {
  if (days <= 0) return '0 j'
  return days === 1 ? '1 jour' : `${days} j`
}

function formatWeight(kg: number): string {
  const rounded = Math.round(kg * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1)
}

export function StatGrid() {
  const { user, profile, isAuthenticated } = useAuth()
  const [stats, setStats] = useState<ProfileStatsSnapshot | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const refresh = useCallback(() => {
    if (!isAuthenticated) {
      setStats(null)
      return
    }
    void loadProfileStats({
      userId: user?.id,
      streakDays: profile?.current_streak ?? 0,
    }).then(setStats)
  }, [isAuthenticated, user?.id, profile?.current_streak])

  useEffect(() => {
    refresh()
    const onRestore = () => refresh()
    window.addEventListener('ranked-gym:backup-restored', onRestore)
    window.addEventListener('ranked-gym:pinned-pr-changed', onRestore)
    return () => {
      window.removeEventListener('ranked-gym:backup-restored', onRestore)
      window.removeEventListener('ranked-gym:pinned-pr-changed', onRestore)
    }
  }, [refresh])

  const streakDays = stats?.streakDays ?? profile?.current_streak ?? 0
  const sessionCount = stats?.sessionCount ?? 0
  const pinned = stats?.pinnedPr ?? null
  const bestPrs = stats?.bestPrs ?? []
  const sparkPoints = stats?.sparkPoints ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  const barProgress = pinned
    ? Math.min(0.96, 0.28 + Math.min(pinned.weightKg, 200) / 220)
    : 0

  const pickPr = (pr: ExercisePr) => {
    setPinnedPr({ exerciseName: pr.exerciseName, weightKg: pr.weightKg })
    setPickerOpen(false)
    refresh()
  }

  const cards: Array<{
    key: string
    icon: LucideIcon
    label: string
    value: string
    sub?: string
    variant: 'orange' | 'blue' | 'crimson'
    visual: 'rings' | 'sparkline' | 'bar'
    onEdit?: () => void
  }> = [
    {
      key: 'streak',
      icon: Flame,
      label: 'Série',
      value: formatStreak(streakDays),
      variant: 'orange',
      visual: 'rings',
    },
    {
      key: 'sessions',
      icon: Dumbbell,
      label: 'Séances',
      value: String(sessionCount),
      sub:
        stats && stats.checkinCount > 0
          ? `${stats.workoutCount} train · ${stats.checkinCount} spot`
          : undefined,
      variant: 'blue',
      visual: 'sparkline',
    },
    {
      key: 'pr',
      icon: Trophy,
      label: 'PR',
      value: pinned ? `${formatWeight(pinned.weightKg)} kg` : '—',
      sub: pinned?.exerciseName ?? 'Aucun PR',
      variant: 'crimson',
      visual: 'bar',
      onEdit: bestPrs.length > 0 ? () => setPickerOpen(true) : undefined,
    },
  ]

  return (
    <section>
      <h3 className="ios-label mb-3 px-1">Statistiques</h3>
      <div className="grid grid-cols-3 gap-3">
        {cards.map((stat) => (
          <div key={stat.key} className="glass-card relative rounded-2xl p-3.5">
            {stat.onEdit ? (
              <button
                type="button"
                onClick={stat.onEdit}
                className="ios-press absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-[#AEAEB2]"
                aria-label="Choisir le PR épinglé"
              >
                <Pencil className="h-3 w-3" strokeWidth={2.25} />
              </button>
            ) : null}
            <div className="mb-3 flex items-start justify-between gap-1 pr-5">
              <IconBadge icon={stat.icon} variant={stat.variant} size="sm" />
              {stat.visual === 'rings' ? (
                <ActivityRings values={streakRings(streakDays)} size={34} />
              ) : null}
              {stat.visual === 'sparkline' ? <Sparkline points={sparkPoints} /> : null}
              {stat.visual === 'bar' ? (
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
                      stroke="#FF2B2B"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 14}
                      strokeDashoffset={2 * Math.PI * 14 * (1 - barProgress)}
                      transform="rotate(-90 18 18)"
                    />
                  </svg>
                </div>
              ) : null}
            </div>
            <p className="text-[18px] font-semibold tracking-tight tabular-nums text-white">
              {stat.value}
            </p>
            {stat.sub ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#AEAEB2]">
                {stat.sub}
              </p>
            ) : null}
            <p className="mt-1 text-[12px] text-[#8E8E93]">{stat.label}</p>
          </div>
        ))}
      </div>

      <IosSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="PR épinglé"
        subtitle="Choisis l’exercice affiché en vitrine"
        leading={<Trophy className="mt-0.5 h-5 w-5 text-[#FF2B2B]" />}
      >
        <ul className="space-y-2 pb-4">
          {bestPrs.map((pr) => {
            const selected =
              pinned?.exerciseName.toLowerCase() === pr.exerciseName.toLowerCase()
            return (
              <li key={pr.exerciseName}>
                <button
                  type="button"
                  onClick={() => pickPr(pr)}
                  className={`ios-press flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left ${
                    selected
                      ? 'border-[#FF2B2B]/45 bg-[#FF2B2B]/15'
                      : 'border-white/10 bg-white/[0.04]'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-white">
                      {pr.exerciseName}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-[#8E8E93]">Meilleur set</span>
                  </span>
                  <span className="shrink-0 text-[17px] font-semibold tabular-nums text-white">
                    {formatWeight(pr.weightKg)} kg
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </IosSheet>
    </section>
  )
}
