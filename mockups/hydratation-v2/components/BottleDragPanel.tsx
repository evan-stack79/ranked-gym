import { PhotoContainer, type PhotoKind } from './PhotoContainer'

/**
 * Contenant grand centré + glisser au niveau de l'eau + estimation ml.
 */
export function BottleDragPanel({
  kind,
  fillRatio,
  estimateMl,
  capacityMl,
}: {
  kind: PhotoKind
  fillRatio: number
  estimateMl: number
  capacityMl: number
}) {
  void capacityMl
  return (
    <div className="relative flex flex-col items-center px-2" data-mockup-drag-panel={kind}>
      <div className="relative w-full max-w-[260px]">
        <PhotoContainer kind={kind} fillRatio={fillRatio} size="large" showHandle />
      </div>
      <p
        className="mt-2 text-center text-[17px] font-semibold tabular-nums tracking-tight text-white"
        data-mockup-estimate
      >
        ≈ {estimateMl}&nbsp;ml bus
      </p>
    </div>
  )
}
