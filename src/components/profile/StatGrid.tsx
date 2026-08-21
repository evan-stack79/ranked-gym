import { useCallback, useEffect, useMemo, useState } from 'react'
import { Flame, Dumbbell, Trophy, Pencil, Search } from 'lucide-react'
import { Sparkline } from '../ui/Sparkline'
import { ActivityRings } from '../ui/ActivityRings'
import { IconBadge } from '../ui/IconBadge'
import { IosSheet } from '../ui/IosSheet'
import { useAuth } from '../../context/AuthContext'
import {
  formatPrAgeLabel,
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
  const [query, setQuery] = useState('')

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

  useEffect(() => {
    if (!pickerOpen) setQuery('')
  }, [pickerOpen])

  const streakDays = stats?.streakDays ?? profile?.current_streak ?? 0
  const sessionCount = stats?.sessionCount ?? 0
  const pinned = stats?.pinnedPr ?? null
  const bestPrs = stats?.bestPrs ?? []
  const sparkPoints = stats?.sparkPoints ?? [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]

  const filteredPrs = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return bestPrs
    return bestPrs.filter((pr) => pr.exerciseName.toLowerCase().includes(q))
  }, [bestPrs, query])

  const pickPr = (pr: ExercisePr) => {
    setPinnedPr({ exerciseName: pr.exerciseName, weightKg: pr.weightKg })
    setPickerOpen(false)
    refresh()
  }

  return (
    <section>
      <h3 className="ios-label mb-3 px-1">Statistiques</h3>

      <div className="grid grid-cols-3 gap-3">
        {/* Série */}
        <div className="glass-card rounded-2xl p-3.5">
          <div className="mb-3 flex items-start justify-between gap-1">
            <IconBadge icon={Flame} variant="orange" size="sm" />
            <ActivityRings values={streakRings(streakDays)} size={34} />
          </div>
          <p className="text-[18px] font-semibold tracking-tight tabular-nums text-white">
            {formatStreak(streakDays)}
          </p>
          <p className="mt-1 text-[12px] text-[#8E8E93]">Série</p>
        </div>

        {/* Séances */}
        <div className="glass-card rounded-2xl p-3.5">
          <div className="mb-3 flex items-start justify-between gap-1">
            <IconBadge icon={Dumbbell} variant="blue" size="sm" />
            <Sparkline points={sparkPoints} />
          </div>
          <p className="text-[18px] font-semibold tracking-tight tabular-nums text-white">
            {sessionCount}
          </p>
          {stats && stats.checkinCount > 0 ? (
            <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#AEAEB2]">
              {stats.workoutCount} train · {stats.checkinCount} spot
            </p>
          ) : null}
          <p className="mt-1 text-[12px] text-[#8E8E93]">Séances</p>
        </div>

        {/* PR épinglé — vitrine premium */}
        <div
          className={`glass-card relative rounded-2xl p-3.5 ${
            pinned ? '' : 'opacity-90'
          }`}
        >
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="ios-press absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-[#AEAEB2]"
            aria-label="Éditer le PR épinglé"
          >
            <Pencil className="h-3 w-3" strokeWidth={2.25} />
          </button>

          <div className="mb-2.5 flex items-start justify-between gap-1 pr-6">
            <IconBadge icon={Trophy} variant="crimson" size="sm" />
          </div>

          {pinned ? (
            <>
              <div className="flex flex-wrap items-baseline gap-1.5">
                <p className="text-[20px] font-bold tracking-tight tabular-nums text-white">
                  {formatWeight(pinned.weightKg)}
                  <span className="ml-0.5 text-[13px] font-semibold text-[#AEAEB2]">kg</span>
                </p>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-[#D1D1D6]">
                {pinned.exerciseName}
              </p>
              <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-[#FF2B2B]/25 bg-[#FF2B2B]/12 px-2 py-0.5 text-[9px] font-semibold tracking-wide text-[#FF8A80]">
                {formatPrAgeLabel(pinned.achievedAt)}
              </span>
              <p className="mt-2 text-[12px] text-[#8E8E93]">PR</p>
            </>
          ) : (
            <>
              <p className="text-[18px] font-semibold tracking-tight text-[#636366]">Aucun PR</p>
              <p className="mt-1 text-[11px] leading-snug text-[#636366]">
                Épingle un exo via le crayon
              </p>
              <p className="mt-2 text-[12px] text-[#8E8E93]">PR</p>
            </>
          )}
        </div>
      </div>

      <IosSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="PR épinglé"
        subtitle="Choisis l’exercice favori en vitrine"
        leading={<Trophy className="mt-0.5 h-5 w-5 text-[#FF2B2B]" />}
      >
        <div className="space-y-3 pb-4">
          {bestPrs.length > 3 ? (
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un exercice…"
                className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-10 pr-4 text-[15px] text-white outline-none placeholder:text-[#636366] focus:border-[#FF2B2B]/35"
              />
            </label>
          ) : null}

          {filteredPrs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[14px] leading-relaxed text-[#8E8E93]">
              {bestPrs.length === 0
                ? 'Aucun exercice avec poids dans tes logs. Enregistre une séance dans Train pour débloquer les PR.'
                : 'Aucun exercice ne correspond à ta recherche.'}
            </p>
          ) : (
            <ul className="max-h-[min(52vh,420px)] space-y-2 overflow-y-auto overscroll-contain">
              {filteredPrs.map((pr) => {
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
                        <span className="mt-0.5 block text-[12px] text-[#8E8E93]">
                          {formatPrAgeLabel(pr.achievedAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-[17px] font-semibold tabular-nums text-white">
                        {formatWeight(pr.weightKg)} kg
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </IosSheet>
    </section>
  )
}
