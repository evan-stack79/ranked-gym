import {
  EXERCISE_PICKER_THUMB_PX,
  resolvePickerIllustrationSrc,
} from '../../utils/exercisePickerIllustrations'

/**
 * Fixed-size picker / search thumbnail.
 * Reserves 64×64 even while loading or when falling back — no layout shift.
 */
export function ExercisePickerThumb({
  canonicalExerciseId,
}: {
  canonicalExerciseId: string | null | undefined
}) {
  const src = resolvePickerIllustrationSrc(canonicalExerciseId)
  const size = EXERCISE_PICKER_THUMB_PX

  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{ width: size, height: size }}
      data-picker-thumb
      data-picker-thumb-state={src ? 'illustration' : 'fallback'}
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
          className="block h-full w-full bg-[#2c2c2e]"
          data-picker-thumb-fallback
        />
      )}
    </div>
  )
}
