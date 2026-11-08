import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import type { HydrationMode } from '../../shared/hydration'

interface BottleVisualProps {
  fillRatio: number
  mode: HydrationMode
  /** PNG découpé local (object URL / data URL). */
  shapeUrl?: string | null
  className?: string
}

/**
 * Silhouette + calque eau. Couleurs neutres (pas de rouge/vert HY-05).
 * fillRatio = restant/objectif → le dessin se vide quand on boit.
 */
export function BottleVisual({
  fillRatio,
  mode,
  shapeUrl,
  className = '',
}: BottleVisualProps) {
  const reduce = usePrefersReducedMotion()
  const waterHeight = `${Math.round(Math.min(1, Math.max(0, fillRatio)) * 100)}%`
  const transition = reduce ? 'none' : 'height 420ms cubic-bezier(0.22, 1, 0.36, 1)'

  if (mode === 'glasses_250') {
    return (
      <div
        className={`relative mx-auto h-28 w-16 ${className}`}
        aria-hidden
        data-hydration-visual="glass"
      >
        <div className="absolute inset-0 rounded-b-xl rounded-t-md border-2 border-[#8E8E93]/70 bg-[#1C1C1E]">
          <div className="absolute inset-x-0 bottom-0 overflow-hidden rounded-b-[10px]" style={{ height: waterHeight, transition }}>
            <div className="h-full w-full bg-[#5AC8FA]/55" />
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'my_bottle' && shapeUrl) {
    return (
      <div
        className={`relative mx-auto h-36 w-24 ${className}`}
        aria-hidden
        data-hydration-visual="my_bottle"
      >
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: `url(${shapeUrl})`,
            maskImage: `url(${shapeUrl})`,
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-[#2C2C2E]/40" />
          <div
            className="absolute inset-x-0 bottom-0 bg-[#5AC8FA]/60"
            style={{ height: waterHeight, transition }}
          />
        </div>
        <img
          src={shapeUrl}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-90"
          draggable={false}
        />
      </div>
    )
  }

  // classic_2l (et fallback Pro expiré)
  return (
    <div
      className={`relative mx-auto h-36 w-20 ${className}`}
      aria-hidden
      data-hydration-visual="classic_2l"
    >
      <svg viewBox="0 0 80 140" className="absolute inset-0 h-full w-full">
        <defs>
          <clipPath id="hy-bottle-clip">
            <path d="M28 8 h24 v10 c0 4 2 6 2 10 v90 c0 10-8 14-14 14 h-0 c-6 0-14-4-14-14 V28 c0-4 2-6 2-10 z" />
          </clipPath>
        </defs>
        <path
          d="M28 8 h24 v10 c0 4 2 6 2 10 v90 c0 10-8 14-14 14 h-0 c-6 0-14-4-14-14 V28 c0-4 2-6 2-10 z"
          fill="#1C1C1E"
          stroke="#8E8E93"
          strokeWidth="2"
        />
        <g clipPath="url(#hy-bottle-clip)">
          <rect
            x="0"
            y={140 - 140 * Math.min(1, Math.max(0, fillRatio))}
            width="80"
            height={140 * Math.min(1, Math.max(0, fillRatio))}
            fill="rgba(90,200,250,0.55)"
            style={reduce ? undefined : { transition: 'y 420ms cubic-bezier(0.22, 1, 0.36, 1), height 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
          />
        </g>
      </svg>
    </div>
  )
}
