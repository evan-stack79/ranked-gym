import { LiveBottleVisual, type BottleDragMode } from './LiveBottleVisual'
import {
  drunkMlFromStartAndCurrent,
  type WaterContainerKind,
} from '../../shared/hydration'

/**
 * Contenant + glisser.
 * setup : remaining libre ; drink : ml bus = départ − final.
 */
export function BottleDragPanel({
  kind,
  remainingMl,
  capacityMl,
  startRemainingMl,
  mode,
  shapeUrl,
  onRemainingChange,
}: {
  kind: WaterContainerKind
  remainingMl: number
  capacityMl: number
  startRemainingMl: number
  mode: BottleDragMode
  shapeUrl?: string | null
  onRemainingChange: (remainingMl: number) => void
}) {
  const drunkMl =
    mode === 'drink'
      ? drunkMlFromStartAndCurrent(startRemainingMl, remainingMl, capacityMl)
      : 0

  return (
    <div
      className="relative flex flex-col items-center px-2"
      data-hydration-drag-panel={kind}
      data-hydration-phase={mode}
    >
      <div className="relative w-full max-w-[260px]">
        <LiveBottleVisual
          kind={kind}
          remainingMl={remainingMl}
          capacityMl={capacityMl}
          startRemainingMl={startRemainingMl}
          mode={mode}
          shapeUrl={shapeUrl}
          size="large"
          showHandle
          handleHint
          interactive
          onRemainingChange={onRemainingChange}
        />
      </div>
      {mode === 'drink' ? (
        <p
          className="mt-2 text-center text-[17px] font-semibold tabular-nums tracking-tight text-white"
          data-hydration-estimate
        >
          ≈ {drunkMl}&nbsp;ml bus
        </p>
      ) : (
        <p
          className="mt-2 text-center text-[15px] font-medium tabular-nums tracking-tight text-[#ACB4BA]"
          data-hydration-setup-level
        >
          Niveau : {remainingMl}&nbsp;ml
        </p>
      )}
    </div>
  )
}
