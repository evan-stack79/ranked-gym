import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  fillRatioFromMl,
  handleBottomPercent,
  mlFromFillRatio,
  mlFromPointerY,
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

interface LiveBottleVisualProps {
  kind: WaterContainerKind
  /** ml dans le contenant (0…capacity). */
  ml: number
  capacityMl: number
  /** URL PNG détouré (Ma bouteille) — sinon shell catalogue. */
  shapeUrl?: string | null
  size?: 'large' | 'thumb'
  showHandle?: boolean
  interactive?: boolean
  onMlChange?: (ml: number) => void
  className?: string
}

/**
 * Contenant photo + eau bleue translucide dessinée en direct.
 * Masque silhouette → teinte eau (plus sombre vers le bas) + ménisque ;
 * PNG shell par-dessus pour conserver les reflets plastique.
 */
export function LiveBottleVisual({
  kind,
  ml,
  capacityMl,
  shapeUrl = null,
  size = 'large',
  showHandle = false,
  interactive = false,
  onMlChange,
  className = '',
}: LiveBottleVisualProps) {
  const shell = shapeUrl || SHELL_SRC[kind]
  const fillRatio = fillRatioFromMl(ml, capacityMl)
  const waterPct = `${handleBottomPercent(kind, fillRatio)}%`
  const isThumb = size === 'thumb'
  const heightClass = HEIGHT_CLASS[kind][size]
  const rootRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef(false)
  const [dragging, setDragging] = useState(false)

  const applyPointer = useCallback(
    (clientY: number) => {
      if (!onMlChange || !rootRef.current) return
      const img = rootRef.current.querySelector('[data-hydration-shell]') as HTMLElement | null
      const rect = (img ?? rootRef.current).getBoundingClientRect()
      const next = mlFromPointerY(clientY, rect, kind, capacityMl)
      onMlChange(next)
    },
    [capacityMl, kind, onMlChange],
  )

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactive || !onMlChange) return
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
      data-fill-ratio={fillRatio.toFixed(3)}
      data-hydration-ml={mlFromFillRatio(fillRatio, capacityMl)}
      style={interactive ? { touchAction: 'none', userSelect: 'none' } : undefined}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? endDrag : undefined}
      onPointerCancel={interactive ? endDrag : undefined}
      role={interactive ? 'slider' : undefined}
      aria-valuemin={interactive ? 0 : undefined}
      aria-valuemax={interactive ? capacityMl : undefined}
      aria-valuenow={interactive ? ml : undefined}
      aria-label={interactive ? 'Niveau d’eau' : undefined}
    >
      <div className="relative mx-auto h-full w-fit">
        {/* Photo détourée (reflets / plastique) */}
        <img
          src={shell}
          alt=""
          draggable={false}
          data-hydration-shell
          className="relative z-0 h-full w-auto select-none object-contain"
        />

        {/*
          Eau intérieure : même silhouette (masque), hauteur = niveau.
          mix-blend-mode multiply + soft-light pour teinter le plastique
          sans écraser les reflets du PNG.
        */}
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
          {/* Ménisque */}
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

        {/* Léger voile highlights pour garder le « plastique » au-dessus de l’eau */}
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
