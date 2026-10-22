import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { Apple, Cookie, CupSoda, Grid2X2, Milk, UtensilsCrossed } from 'lucide-react'
import {
  FOOD_CATEGORIES,
  type FoodCategoryId,
} from '../../utils/foodCategories'

const ITEM_W = 72
const FRICTION = 0.94
const MIN_VELOCITY = 0.08
const MAX_VELOCITY = 48

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function CategoryIcon({ id, selected }: { id: FoodCategoryId; selected: boolean }): ReactNode {
  const stroke = selected && id === 'all' ? 2.5 : 2.1
  const cls = selected && id === 'all' ? 'h-7 w-7 text-white' : 'h-5 w-5'
  switch (id) {
    case 'fruits':
      return <Apple className={cls} strokeWidth={stroke} aria-hidden />
    case 'drinks':
      return <CupSoda className={cls} strokeWidth={stroke} aria-hidden />
    case 'all':
      return <Grid2X2 className={cls} strokeWidth={stroke} aria-hidden />
    case 'meals':
      return <UtensilsCrossed className={cls} strokeWidth={stroke} aria-hidden />
    case 'snacks':
      return <Cookie className={cls} strokeWidth={stroke} aria-hidden />
    case 'dairy':
      return <Milk className={cls} strokeWidth={stroke} aria-hidden />
    default:
      return null
  }
}

interface FoodCategoryWheelProps {
  value: FoodCategoryId
  onChange: (id: FoodCategoryId) => void
}

/**
 * Roue catégorie en ARC horizontal (swipe + inertie).
 * Icônes rondes ; « Tout » = gros rond rouge #FF2B2B au centre.
 */
export function FoodCategoryWheel({ value, onChange }: FoodCategoryWheelProps) {
  const offsetRef = useRef(0)
  const velocityRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const lastXRef = useRef(0)
  const lastTRef = useRef(0)
  const [offset, setOffset] = useState(0)
  const [viewportW, setViewportW] = useState(360)
  const reduced = prefersReducedMotion()
  const trackRef = useRef<HTMLDivElement>(null)

  const indexOf = useCallback((id: FoodCategoryId) => {
    const i = FOOD_CATEGORIES.findIndex((c) => c.id === id)
    return i < 0 ? FOOD_CATEGORIES.findIndex((c) => c.id === 'all') : i
  }, [])

  const centerPad = viewportW / 2 - ITEM_W / 2

  const clampOffset = useCallback((x: number) => {
    const max = 0
    const min = -((FOOD_CATEGORIES.length - 1) * ITEM_W)
    return Math.min(max, Math.max(min, x))
  }, [])

  const offsetForIndex = useCallback((index: number) => -index * ITEM_W, [])

  const nearestIndex = useCallback((x: number) => {
    const raw = Math.round(-x / ITEM_W)
    return Math.min(FOOD_CATEGORIES.length - 1, Math.max(0, raw))
  }, [])

  const commitIndex = useCallback(
    (index: number, animate: boolean) => {
      const next = FOOD_CATEGORIES[index]
      if (!next) return
      const target = offsetForIndex(index)
      if (animate && !reduced) {
        const start = offsetRef.current
        const t0 = performance.now()
        const dur = 220
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / dur)
          const eased = 1 - (1 - p) ** 3
          const cur = start + (target - start) * eased
          offsetRef.current = cur
          setOffset(cur)
          if (p < 1) rafRef.current = requestAnimationFrame(tick)
          else {
            offsetRef.current = target
            setOffset(target)
          }
        }
        if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
        rafRef.current = requestAnimationFrame(tick)
      } else {
        offsetRef.current = target
        setOffset(target)
      }
      if (next.id !== value) onChange(next.id)
    },
    [offsetForIndex, onChange, reduced, value],
  )

  useEffect(() => {
    const el = trackRef.current
    if (!el) return
    const sync = () => setViewportW(el.clientWidth || 360)
    sync()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(sync) : null
    ro?.observe(el)
    return () => ro?.disconnect()
  }, [])

  useEffect(() => {
    if (draggingRef.current) return
    const target = offsetForIndex(indexOf(value))
    offsetRef.current = target
    setOffset(target)
  }, [value, indexOf, offsetForIndex])

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const coast = useCallback(() => {
    if (reduced) {
      commitIndex(nearestIndex(offsetRef.current), false)
      return
    }
    const step = () => {
      if (draggingRef.current) return
      let v = velocityRef.current
      if (Math.abs(v) < MIN_VELOCITY) {
        commitIndex(nearestIndex(offsetRef.current), true)
        return
      }
      v *= FRICTION
      velocityRef.current = v
      const next = clampOffset(offsetRef.current + v)
      offsetRef.current = next
      setOffset(next)
      rafRef.current = requestAnimationFrame(step)
    }
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(step)
  }, [clampOffset, commitIndex, nearestIndex, reduced])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true
    lastXRef.current = event.clientX
    lastTRef.current = performance.now()
    velocityRef.current = 0
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    const dx = event.clientX - lastXRef.current
    const now = performance.now()
    const dt = Math.max(8, now - lastTRef.current)
    velocityRef.current = Math.max(-MAX_VELOCITY, Math.min(MAX_VELOCITY, (dx / dt) * 16))
    lastXRef.current = event.clientX
    lastTRef.current = now
    const next = clampOffset(offsetRef.current + dx)
    offsetRef.current = next
    setOffset(next)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
    if (reduced || Math.abs(velocityRef.current) < MIN_VELOCITY) {
      commitIndex(nearestIndex(offsetRef.current), !reduced)
      return
    }
    coast()
  }

  const selectedIndex = nearestIndex(offset)

  return (
    <div
      ref={trackRef}
      className="relative h-[118px] w-full touch-pan-y select-none overflow-hidden"
      data-food-category-wheel
      role="listbox"
      aria-label="Catégories d’aliments"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute inset-x-[-20%] bottom-0 h-[72px] rounded-[100%] border-t border-white/[0.07]"
        style={{
          transform: 'translateY(40px)',
          background:
            'radial-gradient(ellipse 55% 100% at 50% 0%, rgb(255 43 43 / 0.12) 0%, transparent 72%)',
        }}
        aria-hidden
      />
      <div
        className="absolute top-1 flex will-change-transform"
        style={{
          transform: `translate3d(${centerPad + offset}px, 0, 0)`,
          width: FOOD_CATEGORIES.length * ITEM_W,
        }}
      >
        {FOOD_CATEGORIES.map((cat, index) => {
          const dist = Math.abs(index - selectedIndex)
          const selected = dist === 0
          const isAll = cat.id === 'all'
          const scale = selected ? (isAll ? 1.18 : 1.12) : dist === 1 ? 0.88 : 0.72
          const opacity = selected ? 1 : dist === 1 ? 0.55 : 0.3
          const y = selected ? 0 : dist === 1 ? 10 : 18
          const circleSize = selected && isAll ? 58 : selected ? 48 : 40
          return (
            <button
              key={cat.id}
              type="button"
              role="option"
              aria-selected={selected}
              data-category={cat.id}
              onClick={() => commitIndex(index, !reduced)}
              className="relative flex shrink-0 flex-col items-center justify-start pt-1"
              style={{
                width: ITEM_W,
                transform: `translate3d(0, ${y}px, 0) scale(${scale})`,
                opacity,
                transition: reduced ? undefined : 'transform 180ms ease-out, opacity 180ms ease-out',
              }}
            >
              <span
                className={`flex items-center justify-center rounded-full ${
                  selected && isAll
                    ? 'bg-[#FF2B2B] text-white'
                    : selected
                      ? 'bg-white/[0.12] text-white'
                      : 'bg-white/[0.06] text-[#AEAEB2]'
                }`}
                style={{
                  width: circleSize,
                  height: circleSize,
                  boxShadow:
                    selected && isAll
                      ? '0 0 18px 2px rgb(255 43 43 / 0.45)'
                      : selected
                        ? '0 0 12px rgb(255 255 255 / 0.08)'
                        : undefined,
                }}
              >
                <CategoryIcon id={cat.id} selected={selected} />
              </span>
              <span
                className={`mt-1.5 text-[11px] font-semibold tracking-tight ${
                  selected ? 'text-white' : 'text-[#8E8E93]'
                }`}
              >
                {cat.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
