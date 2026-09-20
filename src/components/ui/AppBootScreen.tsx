import { BrandMark } from '../brand/BrandMark'
import { USER_BOOT_ARIA_LABEL } from '../../boot/bootUiCopy'

/**
 * Splash Ranked Gym sobre — affiché tant que session + hydrate n’ont pas fini.
 * Aucun libellé technique. Les fetches continuent en arrière-plan.
 */
export function AppBootScreen() {
  return (
    <div
      className="flex min-h-[70vh] flex-col gap-8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={USER_BOOT_ARIA_LABEL}
      data-app-boot-screen="1"
    >
      <div className="flex flex-col items-center gap-3 pt-6 pb-1">
        <BrandMark variant="hero" showWordmark={false} />
        <BrandMark variant="hero" showMark={false} />
      </div>

      <HomeBootSkeleton />
    </div>
  )
}

export function HomeBootSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-hidden data-home-boot-skeleton="1">
      <div>
        <SkeletonBlock className="h-8 w-56" />
      </div>
      <SkeletonCard tall />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  )
}

export function SectionSkeleton({
  tall = false,
  label,
}: {
  tall?: boolean
  label?: string
}) {
  return (
    <div
      className="glass-card rounded-2xl p-4"
      aria-busy="true"
      aria-label={label}
      data-section-skeleton="1"
    >
      <SkeletonBlock className="mb-3 h-3 w-20" />
      <SkeletonBlock className={`mb-2 ${tall ? 'h-8 w-40' : 'h-5 w-36'}`} />
      <SkeletonBlock className="h-2.5 w-full" />
      <SkeletonBlock className="mt-2 h-2.5 w-2/3" />
    </div>
  )
}

function SkeletonCard({ tall = false }: { tall?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-white/10 bg-[#1C1C1E]/90 p-4 ${
        tall ? 'min-h-[160px]' : 'min-h-[96px]'
      }`}
    >
      <SkeletonBlock className="mb-3 h-3 w-20" />
      <SkeletonBlock className={`mb-2 ${tall ? 'h-8 w-40' : 'h-5 w-36'}`} />
      <SkeletonBlock className="h-2.5 w-full" />
      <SkeletonBlock className="mt-2 h-2.5 w-3/4" />
    </div>
  )
}

function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-xl ${className}`} />
}
