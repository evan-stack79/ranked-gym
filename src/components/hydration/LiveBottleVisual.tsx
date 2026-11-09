import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  clampRemainingToStart,
  fillRatioFromMl,
  handleBottomPercent,
  mlFromFillRatio,
  remainingMlFromPointerY,
  type WaterContainerKind,
} from '../../shared/hydration'

export const SHELL_SRC: Record<WaterContainerKind, string> = {
  plastic_15: '/assets/hydration/shell_bottle_15.png',
  small_50: '/assets/hydration/shell_bottle_50.png',
  glass_25: '/assets/hydration/shell_glass.png',
  gourd: '/assets/hydration/shell_gourde.png',
}

const HEIGHT_CLASS: Record<WaterContainerKind, { large: string; thumb: string }> = {
  plastic_15: { large: 'h-[176px]', thumb: 'h-[58px]' },
  small_50: { large: 'h-[156px]', thumb: 'h-[52px]' },
  glass_25: { large: 'h-[156px]', thumb: 'h-[52px]' },
  gourd: { large: 'h-[176px]', thumb: 'h-[56px]' },
}

export type BottleDragMode = 'setup' | 'drink'

interface LiveBottleVisualProps {
  kind: WaterContainerKind
  /** Remaining ml affiché (0…capacity). */
  remainingMl: number
  capacityMl: number
  /** Mode boire : plafond = niveau de départ. */
  startRemainingMl?: number
  mode?: BottleDragMode
  shapeUrl?: string | null
  size?: 'large' | 'thumb'
  showHandle?: boolean
  interactive?: boolean
  onRemainingChange?: (remainingMl: number) => void
  className?: string
}

/**
 * Contenant photo + eau live.
 * setup : remaining libre 0…capacité.
 * drink : remaining plafonné au départ (glisser bas uniquement).
 */
export function LiveBottleVisual({
  kind,
  remainingMl,
  capacityMl,
  startRemainingMl,
  mode = 'setup',
  shapeUrl = null,
  size = 'large',
  showHandle = false,
  interactive = false,
  onRemainingChange,
  className = '',
}: LiveBottleVisualProps) {
  const shell = shapeUrl || SHELL_SRC[kind]
  const fillRatio = fillRatioFromMl(remainingMl, capacityMl)
  const waterPct = `${handleBottomPercent(kind, fillRatio)}%`
  const isThumb = size === 'thumb'
  const heightClass = HEIGHT_CLASS[kind][size]
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  const applyPointer = useCallback(
    (clientY: number) => {
      if (!onRemainingChange || !rootRef.current) return
      const img = rootRef.current.querySelector('[data-hydration-shell]') as HTMLElement | null
      const rect = (img ?? rootRef.current).getBoundingClientRect()
      let next = remainingMlFromPointerY(clientY, rect, kind, capacityMl)
      if (mode === 'drink') {
        const start = startRemainingMl ?? capacityMl
        next = clampRemainingToStart(next, start, capacityMl)
      }
      onRemainingChange(next)
    },
    [capacityMl, kind, mode, onRemainingChange, startRemainingMl],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !onRemainingChange) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = true
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
    applyPointer(e.clientY)
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    e.preventDefault()
    applyPointer(e.clientY)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    dragRef.current = false
    setDragging(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  useEffect(() => {
    if (!dragging) return
    const prev = document.body.style.overflow
    const touchPrev = document.body.style.touchAction
    document.body.style.overflow = 'hidden'
    document.body.style.touchAction = 'none'
    return () => {
      document.body.style.overflow = prev
      document.body.style.touchAction = touchPrev
    }
  }, [dragging])

  const maskStyle: CSSProperties = {
    WebkitMaskImage: `url(${shell})`,
    maskImage: `url(${shell})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  }

  return (
    <div
      ref={rootRef}
      className={`relative mx-auto ${heightClass} ${isThumb ? 'w-auto' : 'w-full max-w-[200px]'} ${className}`}
      data-hydration-live-bottle={kind}
      data-hydration-drag-mode={mode}
      data-fill-ratio={fillRatio.toFixed(3)}
      data-hydration-remaining={mlFromFillRatio(fillRatio, capacityMl)}
      style={interactive ? { touchAction: 'none', userSelect: 'none' } : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      role={interactive ? 'slider' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? (mode === 'drink' ? (startRemainingMl ?? capacityMl) : capacityMl) : undefined}
      aria-valuenow={interactive ? remainingMl : undefined}
      aria-label={interactive ? (mode === 'drink' ? 'Niveau restant' : 'Niveau de départ') : undefined}
    >
      <div className="relative mx-auto h-full w-fit">
        <img
          src={shell}
          alt=""
          draggable={false}
          data-hydration-shell
          className="relative z-0 h-full w-auto select-none object-contain"
        />

        <div
          className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
          style={maskStyle}
          aria-hidden
        >
          <div
            className="absolute inset-x-0 bottom-0"
            data-hydration-water-fill
            style={{
              height: waterPct,
              background:
                'linear-gradient(to top, rgba(15, 95, 175, 0.88) 0%, rgba(50, 150, 220, 0.62) 50%, rgba(140, 220, 255, 0.45) 100%)',
              mixBlendMode: 'multiply',
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0"
            style={{
              height: waterPct,
              background:
                'linear-gradient(to top, rgba(20, 110, 190, 0.35) 0%, rgba(160, 230, 255, 0.22) 100%)',
              mixBlendMode: 'soft-light',
            }}
          />
          <div
            className="absolute inset-x-0"
            style={{ bottom: waterPct }}
            data-hydration-meniscus
          >
            <span
              className="mx-auto block h-[2px] w-[72%] rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, transparent, rgba(230,245,255,0.9), transparent)',
                boxShadow: '0 0 6px rgba(90,200,250,0.45)',
                transform: 'translateY(1px)',
              }}
            />
          </div>
        </div>

        <img
          src={shell}
          alt=""
          draggable={false}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[2] h-full w-full object-contain"
          style={{ mixBlendMode: 'screen', opacity: 0.28 }}
        />

        {showHandle ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-[3] h-5"
            style={{ bottom: `calc(${waterPct} - 10px)` }}
            data-hydration-drag-handle
          >
            <div className="relative mx-auto h-5 w-[78%]">
              <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[#5AC8FA]/85" />
              <span className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-[#5AC8FA]" />
              <span className="absolute right-0 top-1/2 flex h-5 w-5 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-[#5AC8FA]/85 bg-[#0B0B0D]">
                <span className="h-2 w-2 rounded-full bg-[#5AC8FA]" />
              </span>
              {!isThumb ? (
                <span className="absolute left-[calc(100%+12px)] top-1/2 w-[5.5rem] -translate-y-1/2 text-[10px] font-medium leading-snug text-[#ACB4BA]">
                  glisse pour régler
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
