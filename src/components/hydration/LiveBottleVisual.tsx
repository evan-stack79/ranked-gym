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
  WATER_DRAG_STEP_ML,
  type WaterContainerKind,
} from '../../shared/hydration'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'

export const SHELL_SRC: Record<WaterContainerKind, string> = {
  plastic_15: '/assets/hydration/shell_bottle_15.png',
  small_50: '/assets/hydration/shell_bottle_50.png',
  glass_25: '/assets/hydration/shell_glass.png',
  gourd: '/assets/hydration/shell_gourde.png',
}

const HEIGHT_CLASS: Record<
  WaterContainerKind,
  { large: string; thumb: string; hero: string }
> = {
  plastic_15: { large: 'h-[176px]', thumb: 'h-[58px]', hero: 'h-[min(52vh,420px)]' },
  small_50: { large: 'h-[156px]', thumb: 'h-[52px]', hero: 'h-[min(48vh,380px)]' },
  glass_25: { large: 'h-[156px]', thumb: 'h-[52px]', hero: 'h-[min(48vh,380px)]' },
  gourd: { large: 'h-[176px]', thumb: 'h-[56px]', hero: 'h-[min(52vh,420px)]' },
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
  size?: 'large' | 'thumb' | 'hero'
  showHandle?: boolean
  /** Affiche le libellé « glisse pour régler » (désactivé en v3). */
  handleHint?: boolean
  /** Zone rouge discrète entre départ et niveau actuel (mode boire). */
  showDrunkZone?: boolean
  /** Bulle ml à gauche du trait (jamais sous le doigt). */
  showMlBubble?: boolean
  interactive?: boolean
  /** Pas de glisser (défaut = précision doigt 1 ml). */
  dragStepMl?: number
  onRemainingChange?: (remainingMl: number) => void
  onDraggingChange?: (dragging: boolean) => void
  /** Appelé à la fin du glisser (variante B : commit au relâchement). */
  onDragEnd?: () => void
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
  handleHint = false,
  showDrunkZone = false,
  showMlBubble = false,
  interactive = false,
  dragStepMl = WATER_DRAG_STEP_ML,
  onRemainingChange,
  onDraggingChange,
  onDragEnd,
  className = '',
}: LiveBottleVisualProps) {
  const shell = shapeUrl || SHELL_SRC[kind]
  const fillRatio = fillRatioFromMl(remainingMl, capacityMl)
  const fillPct = handleBottomPercent(kind, fillRatio)
  const waterPct = `${fillPct}%`
  const startPct =
    startRemainingMl != null
      ? handleBottomPercent(kind, fillRatioFromMl(startRemainingMl, capacityMl))
      : fillPct
  const drunkBandPct = Math.max(0, startPct - fillPct)
  const isThumb = size === 'thumb'
  const heightClass = HEIGHT_CLASS[kind][size]
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
  const [dragging, setDragging] = useState(false)
  const step = dragStepMl > 0 ? dragStepMl : WATER_DRAG_STEP_ML
  const reducedMotion = usePrefersReducedMotion()
  const [waveAmp, setWaveAmp] = useState(0)
  const ampRef = useRef(0)
  const lastMlRef = useRef(remainingMl)
  const mlRef = useRef(remainingMl)
  const rafWaveRef = useRef<number | null>(null)
  const draggingRef = useRef(false)

  useEffect(() => {
    mlRef.current = remainingMl
  }, [remainingMl])

  useEffect(() => {
    draggingRef.current = dragging
    // Relance le tick si on recommence à glisser alors que la boucle s’était arrêtée.
    if (!reducedMotion && dragging && rafWaveRef.current == null) {
      const tick = () => {
        const ml = mlRef.current
        const v = Math.abs(ml - lastMlRef.current)
        lastMlRef.current = ml
        const target = draggingRef.current ? Math.min(1, 0.18 + v / 9) : 0
        ampRef.current += (target - ampRef.current) * (target > ampRef.current ? 0.35 : 0.06)
        if (ampRef.current < 0.004 && target === 0) ampRef.current = 0
        setWaveAmp(ampRef.current)
        if (ampRef.current > 0 || draggingRef.current) {
          rafWaveRef.current = requestAnimationFrame(tick)
        } else {
          rafWaveRef.current = null
        }
      }
      rafWaveRef.current = requestAnimationFrame(tick)
    }
  }, [dragging, reducedMotion])

  // Ondulation transform-only : amplitude ↑ pendant le glisser, amortie ~600 ms après.
  useEffect(() => {
    if (reducedMotion) {
      ampRef.current = 0
      setWaveAmp(0)
      if (rafWaveRef.current != null) {
        cancelAnimationFrame(rafWaveRef.current)
        rafWaveRef.current = null
      }
      return
    }

    return () => {
      if (rafWaveRef.current != null) {
        cancelAnimationFrame(rafWaveRef.current)
        rafWaveRef.current = null
      }
    }
  }, [reducedMotion])

  const applyPointer = useCallback(
    (clientY: number) => {
      if (!onRemainingChange || !rootRef.current) return
      const img = rootRef.current.querySelector('[data-hydration-shell]') as HTMLElement | null
      const rect = (img ?? rootRef.current).getBoundingClientRect()
      let next = remainingMlFromPointerY(clientY, rect, kind, capacityMl, step)
      if (mode === 'drink') {
        const start = startRemainingMl ?? capacityMl
        next = clampRemainingToStart(next, start, capacityMl, step)
      }
      onRemainingChange(next)
    },
    [capacityMl, kind, mode, onRemainingChange, startRemainingMl, step],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !onRemainingChange) return
    e.preventDefault()
    e.stopPropagation()
    dragRef.current = true
    setDragging(true)
    onDraggingChange?.(true)
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
    onDraggingChange?.(false)
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    onDragEnd?.()
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
      className={`relative mx-auto ${heightClass} ${isThumb ? 'w-auto' : 'w-full max-w-[220px]'} ${className}`}
      data-hydration-live-bottle={kind}
      data-hydration-drag-mode={mode}
      data-fill-ratio={fillRatio.toFixed(3)}
      data-hydration-remaining={mlFromFillRatio(fillRatio, capacityMl)}
      data-hydration-dragging={dragging ? '1' : '0'}
      style={interactive ? { touchAction: 'none', userSelect: 'none' } : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      role={interactive ? 'slider' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={
        interactive ? (mode === 'drink' ? (startRemainingMl ?? capacityMl) : capacityMl) : undefined
      }
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
          {showDrunkZone && mode === 'drink' && drunkBandPct > 0.4 ? (
            <div
              className="absolute inset-x-0"
              data-hydration-drunk-zone
              style={{
                bottom: waterPct,
                height: `${drunkBandPct}%`,
                background:
                  'linear-gradient(to top, rgba(255, 7, 2, 0.32) 0%, rgba(255, 7, 2, 0.16) 100%)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,7,2,0.55), inset 0 -1px 0 rgba(255,7,2,0.35)',
              }}
            />
          ) : null}
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

          {/* Surface ondulation — transform scaleY only (no infinite loop). */}
          {!reducedMotion && waveAmp > 0.004 ? (
            <>
              <div
                className="pointer-events-none absolute inset-x-0 origin-bottom"
                data-hydration-wave="b"
                style={{
                  bottom: `calc(${waterPct} - 1px)`,
                  height: 22,
                  width: '200%',
                  left: '-50%',
                  transform: `scaleY(${waveAmp * 0.8})`,
                  willChange: 'transform',
                }}
              >
                <svg
                  viewBox="0 0 400 16"
                  preserveAspectRatio="none"
                  className="block h-full w-full"
                  aria-hidden
                >
                  <path
                    fill="rgba(120,200,245,0.5)"
                    d="M0 8 Q25 0 50 8 T100 8 T150 8 T200 8 T250 8 T300 8 T350 8 T400 8 V16 H0Z"
                  />
                </svg>
              </div>
              <div
                className="pointer-events-none absolute inset-x-0 origin-bottom"
                data-hydration-wave="a"
                style={{
                  bottom: `calc(${waterPct} - 1px)`,
                  height: 22,
                  width: '200%',
                  left: '-50%',
                  transform: `scaleY(${waveAmp})`,
                  willChange: 'transform',
                }}
              >
                <svg
                  viewBox="0 0 400 16"
                  preserveAspectRatio="none"
                  className="block h-full w-full"
                  aria-hidden
                >
                  <path
                    fill="rgba(150,222,255,0.85)"
                    d="M0 9 Q33 1 66 9 T133 9 T200 9 T266 9 T333 9 T400 9 V16 H0Z"
                  />
                </svg>
              </div>
            </>
          ) : null}
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
              {handleHint && !isThumb ? (
                <span className="absolute left-[calc(100%+12px)] top-1/2 w-[5.5rem] -translate-y-1/2 text-[10px] font-medium leading-snug text-[#ACB4BA]">
                  glisse pour régler
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {showMlBubble && !isThumb ? (
          <div
            className="pointer-events-none absolute z-[6] whitespace-nowrap rounded-2xl border border-white/20 bg-[#1C1C1E] px-3 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
            style={{
              bottom: `calc(${waterPct} + 12px)`,
              /* À droite du trait — évite la coupe « H / é » hors cadre. */
              right: '0%',
              transform: 'translateX(12%)',
            }}
            data-hydration-ml-bubble
          >
            <p className="text-[15px] font-semibold tabular-nums tracking-tight text-white">
              {Math.round(remainingMl).toLocaleString('fr-FR')}&nbsp;ml
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
