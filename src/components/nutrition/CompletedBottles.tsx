import { useEffect, useRef } from 'react'
import { Check } from 'lucide-react'

const MAX_VISIBLE = 3

interface CompletedBottlesProps {
  completedCount: number
  /** Déclenche l’animation quand une nouvelle bouteille est terminée. */
  animateKey?: number
}

function completedAriaLabel(count: number): string {
  if (count <= 0) return ''
  if (count === 1) return '1 bouteille de 1,5 litre terminée'
  return `${count} bouteilles de 1,5 litre terminées`
}

/**
 * Mini-bouteilles terminées (1,5 L chacune) — représentation factuelle du journal.
 * Max 3 visibles + pastille +N pour le surplus.
 */
export function CompletedBottles({ completedCount, animateKey = 0 }: CompletedBottlesProps) {
  const prevCountRef = useRef(completedCount)
  const justCompletedRef = useRef(false)

  useEffect(() => {
    if (completedCount > prevCountRef.current) {
      justCompletedRef.current = true
    }
    prevCountRef.current = completedCount
  }, [completedCount, animateKey])

  if (completedCount <= 0) return null

  const visible = Math.min(completedCount, MAX_VISIBLE)
  const overflow = Math.max(0, completedCount - MAX_VISIBLE)

  return (
    <div
      className="completed-bottles flex flex-wrap items-end justify-center gap-2"
      role="img"
      aria-label={completedAriaLabel(completedCount)}
    >
      {Array.from({ length: visible }, (_, i) => {
        const isNewest = i === visible - 1 && justCompletedRef.current
        return (
          <div
            key={`${completedCount}-${i}`}
            className={`completed-bottle-mini flex flex-col items-center ${isNewest ? 'completed-bottle-mini--enter' : ''}`}
            aria-hidden
          >
            <div className="completed-bottle-mini-cap" />
            <div className="completed-bottle-mini-body">
              <div className="completed-bottle-mini-liquid" />
              <Check
                className="completed-bottle-mini-check"
                strokeWidth={3}
                aria-hidden
              />
            </div>
          </div>
        )
      })}
      {overflow > 0 ? (
        <span
          className="completed-bottle-overflow mb-1 flex h-9 min-w-[28px] items-center justify-center rounded-lg border border-white/12 bg-white/[0.06] px-1.5 text-[11px] font-semibold tabular-nums text-[#7DD3FC]"
          aria-hidden
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
