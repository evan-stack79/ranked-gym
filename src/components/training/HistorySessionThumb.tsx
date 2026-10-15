import { Dumbbell } from 'lucide-react'
import type { WorkoutNote } from '../../types/training'
import {
  HISTORY_THUMB_PX,
  resolveHistoryIllustration,
} from '../../utils/historySessionIllustration'

type HistorySessionThumbProps = {
  note: WorkoutNote
  /**
   * `row` — compact history-line thumb (44px, object-contain).
   * `tile` — Accueil gallery square: fills parent with object-cover.
   */
  variant?: 'row' | 'tile'
}

/**
 * Illustration secondaire d’une ligne historique, ou tuile Accueil gallery.
 * Aucun carré / tuile rouge. Graphite uniquement.
 */
export function HistorySessionThumb({ note, variant = 'row' }: HistorySessionThumbProps) {
  const { src, state } = resolveHistoryIllustration(note)

  if (variant === 'tile') {
    return (
      <span
        className="history-thumb history-thumb--tile block h-full w-full overflow-hidden"
        data-history-thumb
        data-history-thumb-variant="tile"
        data-history-thumb-state={state}
        aria-hidden="true"
      >
        {src ? (
          <img
            src={src}
            alt=""
            draggable={false}
            decoding="async"
            className="h-full w-full bg-transparent object-cover object-center"
            data-history-thumb-img="cover"
          />
        ) : (
          <span
            className="flex h-full w-full items-center justify-center text-[#AEAEB2]"
            data-history-thumb-fallback
          >
            <Dumbbell className="h-7 w-7" strokeWidth={1.75} />
          </span>
        )}
      </span>
    )
  }

  const size = HISTORY_THUMB_PX

  return (
    <span
      className="history-thumb shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
      data-history-thumb
      data-history-thumb-variant="row"
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
