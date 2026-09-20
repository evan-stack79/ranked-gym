import { Dumbbell } from 'lucide-react'
import type { WorkoutNote } from '../../types/training'
import {
  HISTORY_THUMB_PX,
  resolveHistoryIllustration,
} from '../../utils/historySessionIllustration'

/**
 * Illustration secondaire d’une ligne historique.
 * Aucun carré / tuile rouge. Graphite uniquement.
 */
export function HistorySessionThumb({ note }: { note: WorkoutNote }) {
  const { src, state } = resolveHistoryIllustration(note)
  const size = HISTORY_THUMB_PX

  return (
    <span
      className="history-thumb shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
      data-history-thumb
      data-history-thumb-state={state}
      aria-hidden="true"
    >
      {src ? (
        <img
          src={src}
          alt=""
          width={size}
          height={size}
          draggable={false}
          decoding="async"
          className="h-full w-full bg-transparent object-contain"
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-[#6E6E73]"
          data-history-thumb-fallback
        >
          <Dumbbell className="h-5 w-5" strokeWidth={1.75} />
        </span>
      )}
    </span>
  )
}
