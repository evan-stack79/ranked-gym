import { BrandMark } from '../brand/BrandMark'

/**
 * Full-screen boot UI — shown until auth session + Supabase profile/cloud hydrate finish.
 * Prevents flash of empty / default stats.
 */
export function AppBootScreen() {
  return (
    <div
      className="flex min-h-[70vh] flex-col gap-6 ios-fade-up"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Chargement des données"
    >
      <div className="flex flex-col items-center gap-4 pt-10 pb-2">
        <div className="relative flex h-[104px] w-[104px] items-center justify-center">
          <span
            className="pointer-events-none absolute inset-0 rounded-full border-2 border-[#FF2B2B]/20"
            aria-hidden
          />
          <span
            className="pointer-events-none absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#FF2B2B]/70"
            aria-hidden
          />
          <BrandMark variant="hero" showWordmark={false} className="relative z-[1]" />
        </div>

        <div className="flex flex-col items-center text-center">
          <BrandMark
            variant="hero"
            showMark={false}
            tagline="Ton sport. Ton niveau. Ta progression."
          />
          <p className="mt-3 text-[13px] text-[#8E8E93]">Récupération de ton profil…</p>
        </div>
      </div>

      <SkeletonCard tall />
      <div className="grid grid-cols-3 gap-2">
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
        <SkeletonBlock className="h-16" />
      </div>
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-3xl border border-white/10 bg-[#1C1C1E]/90 p-5 ${
        tall ? 'min-h-[180px]' : 'min-h-[110px]'
      }`}
    >
      <SkeletonBlock className="mb-4 h-3 w-24" />
      <SkeletonBlock className={`mb-3 ${tall ? 'h-10 w-40' : 'h-7 w-36'}`} />
      <SkeletonBlock className="h-2.5 w-full" />
      <SkeletonBlock className="mt-2 h-2.5 w-3/4" />
    </div>
  )
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} />
}
