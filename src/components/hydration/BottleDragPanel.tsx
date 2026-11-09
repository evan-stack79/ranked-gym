import { LiveBottleVisual } from './LiveBottleVisual'
import type { WaterContainerKind } from '../../shared/hydration'

/**
 * Contenant grand + glisser vers le bas (vide) → ml bus.
 * `ml` = millilitres bus (0 = plein, capacité = vide).
 */
export function BottleDragPanel({
  kind,
  ml,
  capacityMl,
  shapeUrl,
  onMlChange,
}: {
  kind: WaterContainerKind
  /** ml bus (capacité − remaining). */
  ml: number
  capacityMl: number
  shapeUrl?: string | null
  onMlChange: (drunkMl: number) => void
}) {
  return (
    <div className="relative flex flex-col items-center px-2" data-hydration-drag-panel={kind}>
      <div className="relative w-full max-w-[260px]">
        <LiveBottleVisual
          kind={kind}
          ml={ml}
          capacityMl={capacityMl}
          shapeUrl={shapeUrl}
          size="large"
          showHandle
          interactive
          onMlChange={onMlChange}
        />
      </div>
      <p
        className="mt-2 text-center text-[17px] font-semibold tabular-nums tracking-tight text-white"
        data-hydration-estimate
      >
        ≈ {ml}&nbsp;ml bus
      </p>
    </div>
  )
}
