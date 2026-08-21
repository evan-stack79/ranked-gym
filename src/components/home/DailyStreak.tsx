import { useEffect, useState } from 'react'
import { Check, Flame } from 'lucide-react'

/**
 * DailyStreak — série visuelle en haut de l’Accueil.
 *
 * TODO Supabase (prochaine itération) :
 * - Ajouter sur `public.profiles` :
 *     current_streak INT NOT NULL DEFAULT 0
 *     last_active_date TIMESTAMPTZ  -- date du dernier jour validé (UTC day)
 * - À la validation du jour : incrémenter si last_active_date = hier,
 *   reset à 1 si trou, no-op si déjà aujourd’hui ; upsert + sync cloud.
 * - Remplacer le state mock ci-dessous par lecture/écriture profil Supabase.
 */

export function DailyStreak() {
  // Mock local — remplacé plus tard par profiles.current_streak / last_active_date
  const [currentStreak, setCurrentStreak] = useState(4)
  const [isTodayDone, setIsTodayDone] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [displayStreak, setDisplayStreak] = useState(4)

  useEffect(() => {
    if (!animating) {
      setDisplayStreak(currentStreak)
      return
    }
    const bump = window.setTimeout(() => setDisplayStreak(currentStreak), 120)
    const end = window.setTimeout(() => setAnimating(false), 900)
    return () => {
      window.clearTimeout(bump)
      window.clearTimeout(end)
    }
  }, [animating, currentStreak])

  const validateToday = () => {
    if (isTodayDone || animating) return
    setAnimating(true)
    setIsTodayDone(true)
    setCurrentStreak((n) => n + 1)
  }

  return (
    <section className="ios-fade-up space-y-3">
      <div
        className={`streak-card relative overflow-hidden rounded-2xl border px-4 py-3.5 transition-all duration-500 ${
          isTodayDone
            ? 'border-[#FF2B2B]/45 streak-card--lit'
            : 'border-white/10 bg-[#1C1C1E]/75'
        }`}
        style={
          isTodayDone
            ? {
                background:
                  'radial-gradient(ellipse 80% 120% at 0% 50%, rgb(255 43 43 / 0.28) 0%, transparent 55%), rgb(28 28 30 / 0.82)',
                boxShadow:
                  'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 0 28px rgb(255 43 43 / 0.22)',
              }
            : {
                background: 'rgb(28 28 30 / 0.72)',
                backdropFilter: 'blur(16px)',
                boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
              }
        }
      >
        {isTodayDone && (
          <div
            className="pointer-events-none absolute -right-6 -top-8 h-28 w-28 rounded-full blur-2xl"
            style={{ background: 'radial-gradient(circle, #FF2B2B66 0%, transparent 70%)' }}
            aria-hidden
          />
        )}

        <div className="relative flex items-center gap-3.5">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500 ${
              isTodayDone
                ? `border-[#FF2B2B]/50 bg-[#FF2B2B]/20 streak-flame ${animating ? 'streak-flame--pop' : ''}`
                : 'border-white/10 bg-white/5'
            }`}
          >
            <Flame
              className={`h-6 w-6 transition-all duration-500 ${
                isTodayDone
                  ? 'text-[#FF2B2B] drop-shadow-[0_0_10px_rgba(255,43,43,0.85)]'
                  : 'text-[#636366]'
              } ${animating ? 'scale-125' : 'scale-100'}`}
              strokeWidth={2.25}
              fill={isTodayDone ? 'currentColor' : 'none'}
            />
          </div>

          <div className="min-w-0 flex-1">
            {isTodayDone ? (
              <>
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#FF9F0A]">
                  Série en cours
                </p>
                <p
                  className={`mt-0.5 text-[22px] font-black tracking-tight text-white transition-transform duration-300 ${
                    animating ? 'streak-count--bump' : ''
                  }`}
                  style={{
                    textShadow: '0 0 18px rgb(255 43 43 / 0.45)',
                  }}
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
                  Maintiens ta série aujourd&apos;hui !
                </p>
              </>
            )}
          </div>

          {isTodayDone && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#30D158]/35 bg-[#30D158]/15 px-2.5 py-1 text-[11px] font-bold text-[#30D158]">
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Validé
            </span>
          )}
        </div>
      </div>

      {/* Bouton temporaire — retirer quand le streak sera branché sur Train / check-in */}
      {!isTodayDone && (
        <button
          type="button"
          onClick={validateToday}
          className="btn-brand ios-press flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-[15px] font-semibold text-white"
        >
          <Flame className="h-4 w-4" />
          Valider aujourd&apos;hui
        </button>
      )}
    </section>
  )
}
