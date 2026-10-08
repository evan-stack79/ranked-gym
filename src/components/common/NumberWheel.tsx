import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { vibrate } from '../../utils/haptics'
import { playWheelTickSound } from '../../utils/wheelTickSound'

const ITEM_H = 56
const VISIBLE = 5
const VIEWPORT_H = ITEM_H * VISIBLE
const FRICTION = 0.925
const MIN_VELOCITY = 0.18

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.min(count - 1, Math.max(0, index))
}

function indexFromOffset(offset: number, count: number): number {
  const raw = Math.round(-offset / ITEM_H)
  return clampIndex(raw, count)
}

export interface NumberWheelProps {
  min: number
  max: number
  step?: number
  value: number | null
  onChange: (value: number | null) => void
  unit: string
  'aria-label': string
  className?: string
  disabled?: boolean
}

/**
 * Vertical rolling number wheel — big center digit, faded neighbours, side markers.
 * Touch + mouse + keyboard; momentum + snap; identical tick feedback every value.
 */
export function NumberWheel({
  min,
  max,
  step = 1,
  value,
  onChange,
  unit,
  'aria-label': ariaLabel,
  className = '',
  disabled = false,
}: NumberWheelProps) {
  const list = useMemo(() => {
    const items: number[] = []
    const precision = step < 1 ? Math.round(1 / step) : 1
    for (let v = min; v <= max + 1e-9; v += step) {
      items.push(Math.round(v * precision) / precision)
    }
    return items
  }, [min, max, step])
  const count = list.length

  const findIndex = useCallback(
    (v: number | null): number => {
      if (v == null || !Number.isFinite(v)) return -1
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < list.length; i += 1) {
        const d = Math.abs(list[i]! - v)
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      }
      return best
    },
    [list],
  )

  const offsetForIndex = (index: number) => -index * ITEM_H
  const centerPad = ((VISIBLE - 1) / 2) * ITEM_H

  const [offset, setOffset] = useState(() => {
    const idx = findIndex(value)
    return idx < 0 ? 0 : offsetForIndex(idx)
  })
  const [tickPulse, setTickPulse] = useState(0)
  const offsetRef = useRef(offset)
  const valueRef = useRef(value)
  const dragging = useRef(false)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)
  const raf = useRef<number | null>(null)
  const lastEmittedIndex = useRef(findIndex(value))

  useEffect(() => {
    valueRef.current = value
    if (dragging.current) return
    const idx = findIndex(value)
    if (idx < 0) {
      offsetRef.current = 0
      setOffset(0)
      lastEmittedIndex.current = -1
      return
    }
    const next = offsetForIndex(idx)
    offsetRef.current = next
    setOffset(next)
    lastEmittedIndex.current = idx
  }, [value, findIndex])

  const stopRaf = () => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }

  const fireTickFeedback = useCallback(() => {
    vibrate(8)
    playWheelTickSound()
    if (!prefersReducedMotion()) {
      setTickPulse((n) => n + 1)
    }
  }, [])

  const emitIndex = useCallback(
    (index: number, withFeedback: boolean) => {
      if (index < 0 || index >= count) return
      const next = list[index]!
      if (lastEmittedIndex.current !== index) {
        lastEmittedIndex.current = index
        if (withFeedback) fireTickFeedback()
      }
      if (valueRef.current !== next) {
        onChange(next)
      }
    },
    [count, list, onChange, fireTickFeedback],
  )

  const snapToNearest = useCallback(
    (withFeedback: boolean) => {
      const idx = indexFromOffset(offsetRef.current, count)
      const snapped = offsetForIndex(idx)
      offsetRef.current = snapped
      setOffset(snapped)
      emitIndex(idx, withFeedback)
    },
    [count, emitIndex],
  )

  const runMomentum = useCallback(() => {
    stopRaf()
    if (prefersReducedMotion()) {
      snapToNearest(true)
      return
    }
    const stepFrame = () => {
      if (dragging.current) return
      let v = velocity.current
      if (Math.abs(v) < MIN_VELOCITY) {
        snapToNearest(true)
        return
      }
      v *= FRICTION
      velocity.current = v
      let next = offsetRef.current + v
      const minOff = offsetForIndex(count - 1)
      const maxOff = offsetForIndex(0)
      if (next > maxOff) {
        next = maxOff
        velocity.current = 0
      } else if (next < minOff) {
        next = minOff
        velocity.current = 0
      }
      offsetRef.current = next
      setOffset(next)
      const idx = indexFromOffset(next, count)
      emitIndex(idx, true)
      raf.current = requestAnimationFrame(stepFrame)
    }
    raf.current = requestAnimationFrame(stepFrame)
  }, [count, emitIndex, snapToNearest])

  useEffect(() => () => stopRaf(), [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    stopRaf()
    lastY.current = e.clientY
    lastT.current = performance.now()
    velocity.current = 0
    if (valueRef.current == null) {
      const mid = Math.floor(count / 2)
      const midOff = offsetForIndex(mid)
      offsetRef.current = midOff
      setOffset(midOff)
      emitIndex(mid, true)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || disabled) return
    const now = performance.now()
    const dy = e.clientY - lastY.current
    const dt = Math.max(1, now - lastT.current)
    lastY.current = e.clientY
    lastT.current = now
    velocity.current = dy / (dt / 16.67)
    let next = offsetRef.current + dy
    const minOff = offsetForIndex(count - 1)
    const maxOff = offsetForIndex(0)
    next = Math.min(maxOff, Math.max(minOff, next))
    offsetRef.current = next
    setOffset(next)
    const idx = indexFromOffset(next, count)
    emitIndex(idx, true)
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
    runMomentum()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    const currentIdx = value == null ? Math.floor(count / 2) : findIndex(value)
    let nextIdx = currentIdx
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      nextIdx = clampIndex(currentIdx - 1, count)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      nextIdx = clampIndex(currentIdx + 1, count)
    } else if (e.key === 'Home') {
      e.preventDefault()
      nextIdx = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      nextIdx = count - 1
    } else if (e.key === 'PageUp') {
      e.preventDefault()
      nextIdx = clampIndex(currentIdx - 5, count)
    } else if (e.key === 'PageDown') {
      e.preventDefault()
      nextIdx = clampIndex(currentIdx + 5, count)
    } else {
      return
    }
    stopRaf()
    const snapped = offsetForIndex(nextIdx)
    offsetRef.current = snapped
    setOffset(snapped)
    emitIndex(nextIdx, true)
  }

  const isEmpty = value == null
  const activeIndex = isEmpty ? -1 : findIndex(value)
  const ariaNow = isEmpty ? undefined : (value ?? undefined)
  const ariaText = isEmpty ? 'non renseigné' : `${value} ${unit}`

  const centerIdx = isEmpty ? Math.floor(count / 2) : indexFromOffset(offset, count)
  const from = Math.max(0, centerIdx - 5)
  const to = Math.min(count - 1, centerIdx + 5)

  return (
    <div className={`relative select-none ${className}`} data-testid="number-wheel">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={ariaNow}
        aria-valuetext={ariaText}
        aria-orientation="vertical"
        aria-disabled={disabled || undefined}
        className="relative mx-auto w-full max-w-[320px] touch-none overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-white/30"
        style={{ height: VIEWPORT_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-1 top-1/2 z-20 -translate-y-1/2 sm:left-3"
          style={{
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderLeft: '9px solid #FFD60A',
          }}
        />
        <span
          aria-hidden
          className="pointer-events-none absolute right-1 top-1/2 z-20 -translate-y-1/2 sm:right-3"
          style={{
            width: 0,
            height: 0,
            borderTop: '7px solid transparent',
            borderBottom: '7px solid transparent',
            borderRight: '9px solid #FFD60A',
          }}
        />

        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[72px]"
          style={{ background: 'linear-gradient(to bottom, #0c0c0e 5%, transparent)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[72px]"
          style={{ background: 'linear-gradient(to top, #0c0c0e 5%, transparent)' }}
        />

        {isEmpty ? (
          <div
            className="absolute inset-x-0 flex items-center justify-center font-bold text-white"
            style={{ top: centerPad, height: ITEM_H, fontSize: 64, letterSpacing: '-0.03em' }}
            data-testid="number-wheel-empty"
          >
            —
          </div>
        ) : (
          <div
            className="absolute inset-x-0"
            style={{
              top: centerPad,
              height: count * ITEM_H,
              transform: `translate3d(0, ${offset}px, 0)`,
              willChange: 'transform',
            }}
          >
            {Array.from({ length: to - from + 1 }, (_, i) => {
              const idx = from + i
              const v = list[idx]!
              const dist = Math.abs(idx - activeIndex)
              const isCenter = idx === activeIndex
              const opacity = isCenter ? 1 : Math.max(0.14, 0.58 - dist * 0.2)
              const scale = isCenter ? 1 : Math.max(0.52, 1 - dist * 0.2)
              const fontSize = isCenter ? 64 : Math.max(22, 42 - dist * 10)
              const color = isCenter ? '#ffffff' : '#636366'
              const pulse =
                isCenter && tickPulse > 0 && !prefersReducedMotion() ? 1.04 : 1
              return (
                <div
                  key={`${v}-${idx}`}
                  className="absolute inset-x-0 flex items-center justify-center font-bold tabular-nums"
                  data-testid={isCenter ? 'number-wheel-center' : undefined}
                  data-wheel-tick={isCenter ? tickPulse : undefined}
                  style={{
                    top: idx * ITEM_H,
                    height: ITEM_H,
                    fontSize,
                    color,
                    opacity,
                    transform: `scale(${scale * pulse})`,
                    transition: prefersReducedMotion()
                      ? undefined
                      : 'transform 90ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
                    letterSpacing: '-0.03em',
                  }}
                >
                  {Number.isInteger(step) || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(1)}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
