interface ChartSkeletonProps {
  variant?: 'radar' | 'line' | 'gauge'
  className?: string
}

export function ChartSkeleton({ variant = 'line', className = '' }: ChartSkeletonProps) {
  if (variant === 'radar') {
    return (
      <div
        className={`mx-auto flex h-[260px] w-full max-w-[280px] items-center justify-center ${className}`}
        aria-hidden
      >
        <div className="relative h-44 w-44 animate-pulse rounded-full border border-white/10 bg-white/[0.04]">
          <div className="absolute inset-6 rounded-full border border-white/8 bg-white/[0.03]" />
          <div className="absolute inset-12 rounded-full border border-white/6 bg-white/[0.02]" />
        </div>
      </div>
    )
  }

  if (variant === 'gauge') {
    return (
      <div className={`space-y-4 ${className}`} aria-hidden>
        <div className="h-4 w-2/3 animate-pulse rounded-lg bg-white/10" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-3 flex-1 animate-pulse rounded-md bg-white/10" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`} aria-hidden>
      <div className="h-[148px] w-full animate-pulse rounded-xl bg-white/[0.06]" />
      <div className="flex justify-between">
        <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
        <div className="h-3 w-12 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  )
}

interface ChartLoadingOverlayProps {
  label?: string
}

export function ChartLoadingOverlay({ label = 'Chargement des stats…' }: ChartLoadingOverlayProps) {
  return (
    <p className="flex items-center justify-center gap-2 py-2 text-[12px] text-[#8E8E93]">
      <span className="avatar-spinner h-4 w-4 rounded-full border-2 border-white/20 border-t-[#FF2B2B]" />
      {label}
    </p>
  )
}
