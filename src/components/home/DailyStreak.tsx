import { useEffect, useState } from 'react'
import { Check, Flame, Sparkles } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import {
  isStreakActiveToday,
  STREAK_WEEK_BONUS_XP,
} from '../../services/streakService'

/**
 * DailyStreak — série connectée à Supabase (`profiles.current_streak`, `last_login_date`).
 * Le compteur est mis à jour automatiquement à chaque ouverture / login (AuthContext).
 */
export function DailyStreak() {
  const {
    profile,
    isAuthenticated,
    requireAuth,
    streakWeekBonus,
    clearStreakWeekBonus,
  } = useAuth()

  const currentStreak = profile?.current_streak ?? 0
  const isTodayDone = isStreakActiveToday(profile)
  const [displayStreak, setDisplayStreak] = useState(currentStreak)
  const [bump, setBump] = useState(false)
  const [bonusFlash, setBonusFlash] = useState<{ streak: number; bonusXp: number } | null>(null)

  useEffect(() => {
    setDisplayStreak(currentStreak)
  }, [profile?.id])

  useEffect(() => {
    if (currentStreak === displayStreak) return
    setBump(true)
    const t = window.setTimeout(() => {
      setDisplayStreak(currentStreak)
      setBump(false)
    }, 120)
    return () => window.clearTimeout(t)
  }, [currentStreak, displayStreak])

  useEffect(() => {
    if (!streakWeekBonus) return
    setBonusFlash(streakWeekBonus)
    const t = window.setTimeout(() => {
      setBonusFlash(null)
      clearStreakWeekBonus()
    }, 5200)
    return () => window.clearTimeout(t)
  }, [streakWeekBonus, clearStreakWeekBonus])

  if (!isAuthenticated) {
    return (
      <section className="ios-fade-up">
        <button
          type="button"
          onClick={() => requireAuth(() => undefined)}
          className="streak-card relative flex w-full items-center gap-3.5 overflow-hidden rounded-2xl border border-white/10 px-4 py-3.5 text-left"
          style={{
            background: 'rgb(28 28 30 / 0.72)',
            backdropFilter: 'blur(16px)',
            boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
          }}
        >
          <Flame className="h-7 w-7 shrink-0 text-[#636366]" strokeWidth={2.25} />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8E8E93]">
              Série quotidienne
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-[#AEAEB2]">
              Connecte-toi pour allumer ta flamme
            </p>
          </div>
        </button>
      </section>
    )
  }

  const lit = isTodayDone && currentStreak > 0
  const weekGlow = Boolean(bonusFlash)

  return (
    <section className="ios-fade-up space-y-3">
      <div
        className={`streak-card relative overflow-hidden rounded-2xl border px-4 py-3.5 transition-all duration-500 ${
          lit
            ? `border-[#FF2B2B]/45 ${weekGlow ? 'streak-card--jackpot' : 'streak-card--lit'}`
            : 'border-white/10'
        }`}
        style={
          lit
            ? {
                background:
                  'radial-gradient(ellipse 90% 120% at 8% 40%, rgb(255 43 43 / 0.32) 0%, transparent 55%), rgb(28 28 30 / 0.82)',
                boxShadow: weekGlow
                  ? 'inset 0 1px 0 rgb(255 255 255 / 0.1), 0 0 42px rgb(255 43 43 / 0.45), 0 0 80px rgb(255 159 10 / 0.2)'
                  : 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 28px rgb(255 43 43 / 0.22)',
              }
            : {
                background: 'rgb(28 28 30 / 0.72)',
                backdropFilter: 'blur(16px)',
                boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
              }
        }
      >
        {lit && (
          <div
            className="pointer-events-none absolute -left-4 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, #FF2B2B77 0%, transparent 70%)' }}
            aria-hidden
          />
        )}

        <div className="relative flex items-center gap-3">
          <Flame
            className={`h-8 w-8 shrink-0 transition-all duration-500 ${
              lit
                ? `text-[#FF2B2B] drop-shadow-[0_0_14px_rgba(255,43,43,0.95)] ${bump ? 'streak-flame--pop' : ''}`
                : 'text-[#636366]'
            }`}
            strokeWidth={2.25}
            fill={lit ? 'currentColor' : 'none'}
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            {lit ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9F0A]">
                  Série en cours
                </p>
                <p
                  className={`mt-0.5 text-[22px] font-black tracking-tight text-white ${
                    bump ? 'streak-count--bump' : ''
                  }`}
                  style={{ textShadow: '0 0 18px rgb(255 43 43 / 0.45)' }}
                >
                  {displayStreak}{' '}
                  <span className="text-[18px] font-bold text-[#FF2B2B]">
                    Jour{displayStreak > 1 ? 's' : ''} de feu
                  </span>
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8E8E93]">
                  Série · {currentStreak} j
                </p>
                <p className="mt-0.5 text-[16px] font-semibold leading-snug text-[#AEAEB2]">
                  {currentStreak > 0
                    ? 'Maintiens ta série — reviens demain !'
                    : 'Ouvre l’app demain pour enchaîner'}
                </p>
              </>
            )}
          </div>

          {lit && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#30D158]/35 bg-[#30D158]/15 px-2.5 py-1 text-[11px] font-bold text-[#30D158]">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Aujourd’hui
            </span>
          )}
        </div>
      </div>

      {bonusFlash && (
        <div
          className="streak-bonus-toast relative overflow-hidden rounded-2xl border border-[#FFD60A]/40 px-4 py-3.5"
          style={{
            background:
              'radial-gradient(ellipse 80% 100% at 50% 0%, rgb(255 214 10 / 0.28) 0%, transparent 60%), rgb(28 28 30 / 0.95)',
            boxShadow: '0 0 36px rgb(255 43 43 / 0.35), inset 0 1px 0 rgb(255 255 255 / 0.1)',
          }}
          role="status"
        >
          <div className="pointer-events-none absolute inset-0 streak-confetti" aria-hidden />
          <div className="relative flex items-center gap-3">
            <Sparkles className="h-6 w-6 shrink-0 text-[#FFD60A]" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-black tracking-tight text-white">
                Semaine parfaite ! +{bonusFlash.bonusXp || STREAK_WEEK_BONUS_XP} XP bonus
              </p>
              <p className="mt-0.5 text-[12px] text-[#AEAEB2]">
                {bonusFlash.streak} jours de feu — continue comme ça.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
