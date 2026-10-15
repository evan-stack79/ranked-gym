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
/** Higher friction → longer coast (fast flick travels farther). */
const FRICTION = 0.972
const MIN_VELOCITY = 0.12
const MAX_VELOCITY = 95
const VELOCITY_SCALE = 3.4
const TICK_MIN_MS = 35
const TAP_MOVE_PX = 10
const TAP_MAX_MS = 320

/** Unique invalid keypad message — no “ideal” tip. */
export const WHEEL_INVALID_MESSAGE = 'Valeur invalide.'
/** @deprecated Use WHEEL_INVALID_MESSAGE */
export const WHEEL_OUT_OF_RANGE_MESSAGE = WHEEL_INVALID_MESSAGE

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

/** French UI: integers as-is, one decimal with comma (« 70,5 »). */
export function formatWheelValue(v: number): string {
  if (!Number.isFinite(v)) return '—'
  const rounded = Math.round(v * 10) / 10
  if (Number.isInteger(rounded)) return String(rounded)
  return rounded.toFixed(1).replace('.', ',')
}

/**
 * Parse keypad text.
 * - '' / whitespace → null (empty, never 0)
 * - « 70,5 » / « 70.5 » → 70.5 (at most 1 decimal; more decimals → invalid, not rounded)
 * - garbage (« abc », « 70,5,2 », « , ») → 'invalid'
 */
export function parseWheelKeypadInput(raw: string): number | null | 'invalid' {
  const trimmed = raw.trim().replace(/\u00a0/g, '')
  if (trimmed === '') return null
  // Lone separators are invalid (not empty).
  if (trimmed === ',' || trimmed === '.') return 'invalid'
  // At most one decimal digit; comma or dot. Reject 70,55 / 70.55 / trailing sep.
  if (!/^\d+([.,]\d)?$/.test(trimmed)) return 'invalid'
  const n = Number.parseFloat(trimmed.replace(',', '.'))
  if (!Number.isFinite(n)) return 'invalid'
  return Math.round(n * 10) / 10
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
  /**
   * Extra validation after parsing (e.g. lb → kg bounds).
   * Return false to refuse the value with the out-of-range message.
   */
  validateParsed?: (displayValue: number) => boolean
}

/**
 * Vertical rolling number wheel — big center digit, faded neighbours, side markers.
 * Touch + mouse + keyboard; momentum + snap; tap-to-type keypad; throttled tick feedback.
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
  validateParsed,
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
  const midIndex = Math.floor(count / 2)

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
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [keypadError, setKeypadError] = useState<string | null>(null)
  const offsetRef = useRef(offset)
  const valueRef = useRef(value)
  const dragging = useRef(false)
  const seededFromEmpty = useRef(false)
  const pointerStart = useRef({ y: 0, t: 0, moved: false })
  const lastY = useRef(0)
  const lastT = useRef(0)
  const velocity = useRef(0)
  const samples = useRef<Array<{ dy: number; dt: number }>>([])
  const raf = useRef<number | null>(null)
  const lastEmittedIndex = useRef(findIndex(value))
  const lastTickAt = useRef(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    valueRef.current = value
    if (dragging.current || editing) return
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
  }, [value, findIndex, editing])

  const stopRaf = () => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current)
      raf.current = null
    }
  }

  const fireTickFeedback = useCallback(() => {
    const now = performance.now()
    if (now - lastTickAt.current < TICK_MIN_MS) return
    lastTickAt.current = now
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

  const seedMidIfEmpty = useCallback(() => {
    if (valueRef.current != null || seededFromEmpty.current) return
    seededFromEmpty.current = true
    const midOff = offsetForIndex(midIndex)
    offsetRef.current = midOff
    setOffset(midOff)
    emitIndex(midIndex, true)
  }, [emitIndex, midIndex])

  const runMomentum = useCallback(() => {
    stopRaf()
    if (prefersReducedMotion()) {
      // Instant snap — no coast, no tick animation.
      snapToNearest(true)
      return
    }
    let v = velocity.current * VELOCITY_SCALE
    if (v > MAX_VELOCITY) v = MAX_VELOCITY
    if (v < -MAX_VELOCITY) v = -MAX_VELOCITY
    velocity.current = v

    const stepFrame = () => {
      if (dragging.current) return
      let speed = velocity.current
      if (Math.abs(speed) < MIN_VELOCITY) {
        snapToNearest(true)
        return
      }
      speed *= FRICTION
      velocity.current = speed
      let next = offsetRef.current + speed
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

  const openKeypad = useCallback(() => {
    if (disabled) return
    stopRaf()
    dragging.current = false
    setKeypadError(null)
    setEditText(valueRef.current == null ? '' : String(valueRef.current).replace('.', ','))
    setEditing(true)
    window.requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
  }, [disabled])

  const closeKeypad = useCallback(() => {
    setEditing(false)
    setKeypadError(null)
    setEditText('')
  }, [])

  const commitKeypad = useCallback(() => {
    const parsed = parseWheelKeypadInput(editText)
    if (parsed === 'invalid') {
      // Nothing saved — previous value / empty kept.
      setKeypadError(WHEEL_INVALID_MESSAGE)
      window.requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    if (parsed == null) {
      // Empty → null, never 0
      onChange(null)
      closeKeypad()
      return
    }
    const inRange = parsed >= min && parsed <= max
    const extraOk = validateParsed ? validateParsed(parsed) : true
    if (!inRange || !extraOk) {
      // Out of range → Valeur invalide., nothing saved.
      setKeypadError(WHEEL_INVALID_MESSAGE)
      window.requestAnimationFrame(() => inputRef.current?.focus())
      return
    }
    onChange(parsed)
    closeKeypad()
  }, [editText, min, max, onChange, validateParsed, closeKeypad])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || editing) return
    // Don't start drag when targeting the keypad input
    if ((e.target as HTMLElement).closest?.('[data-testid="number-wheel-keypad"]')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    seededFromEmpty.current = false
    suppressClick.current = false
    stopRaf()
    const now = performance.now()
    pointerStart.current = { y: e.clientY, t: now, moved: false }
    lastY.current = e.clientY
    lastT.current = now
    velocity.current = 0
    samples.current = []
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || disabled || editing) return
    const now = performance.now()
    const dy = e.clientY - lastY.current
    const dt = Math.max(1, now - lastT.current)
    const totalMove = Math.abs(e.clientY - pointerStart.current.y)
    if (totalMove > TAP_MOVE_PX) {
      if (!pointerStart.current.moved) {
        pointerStart.current.moved = true
        // First real drag from empty → mid of hidden bounds (140 kg / 175 cm).
        seedMidIfEmpty()
      }
    } else if (!pointerStart.current.moved) {
      lastY.current = e.clientY
      lastT.current = now
      return
    }

    lastY.current = e.clientY
    lastT.current = now
    samples.current.push({ dy, dt })
    if (samples.current.length > 6) samples.current.shift()
    const sumDy = samples.current.reduce((a, s) => a + s.dy, 0)
    const sumDt = samples.current.reduce((a, s) => a + s.dt, 0)
    velocity.current = sumDy / (sumDt / 16.67)

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
    const elapsed = performance.now() - pointerStart.current.t
    const wasTap = !pointerStart.current.moved && elapsed <= TAP_MAX_MS
    if (wasTap) {
      suppressClick.current = true
      openKeypad()
      return
    }
    runMomentum()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || editing) return
    const currentIdx = value == null ? midIndex : findIndex(value)
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
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openKeypad()
      return
    } else {
      return
    }
    stopRaf()
    if (value == null) {
      // Keyboard from empty lands on mid first then steps
      seededFromEmpty.current = true
    }
    const snapped = offsetForIndex(nextIdx)
    offsetRef.current = snapped
    setOffset(snapped)
    emitIndex(nextIdx, true)
  }

  const isEmpty = value == null && !editing
  const activeIndex = value == null ? -1 : findIndex(value)
  const ariaNow = value == null ? undefined : value
  const ariaText = value == null ? 'non renseigné' : `${value} ${unit}`

  const centerIdx =
    value == null && !editing ? midIndex : indexFromOffset(offset, count)
  const from = Math.max(0, centerIdx - 5)
  const to = Math.min(count - 1, centerIdx + 5)
  const reduced = prefersReducedMotion()

  return (
    <div className={`relative select-none ${className}`} data-testid="number-wheel">
      <div
        role="slider"
        tabIndex={disabled || editing ? -1 : 0}
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
            borderLeft: '9px solid var(--color-brand)',
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
            borderRight: '9px solid var(--color-brand)',
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

        {editing ? (
          <div
            className="absolute inset-x-0 z-30 flex items-center justify-center"
            style={{ top: centerPad, height: ITEM_H }}
          >
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              pattern="[0-9]*[.,]?[0-9]*"
              enterKeyHint="done"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-label={`${ariaLabel} — saisie clavier`}
              data-testid="number-wheel-keypad"
              value={editText}
              onChange={(e) => {
                // Allow any text; commitKeypad rejects garbage with « Valeur invalide. »
                setEditText(e.target.value)
                setKeypadError(null)
              }}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitKeypad()
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  closeKeypad()
                }
              }}
              onBlur={() => {
                // Blur without change / Escape path: if text equals previous display, no-op
                const prev =
                  valueRef.current == null ? '' : String(valueRef.current).replace('.', ',')
                const normalized = editText.trim().replace('.', ',')
                if (normalized === prev || (normalized === '' && valueRef.current == null)) {
                  closeKeypad()
                  return
                }
                commitKeypad()
              }}
              className="w-full bg-transparent text-center font-bold tabular-nums text-white outline-none caret-brand"
              style={{ fontSize: 64, letterSpacing: '-0.03em', height: ITEM_H }}
            />
          </div>
        ) : isEmpty ? (
          <button
            type="button"
            className="absolute inset-x-0 flex items-center justify-center font-bold text-white"
            style={{ top: centerPad, height: ITEM_H, fontSize: 64, letterSpacing: '-0.03em' }}
            data-testid="number-wheel-empty"
            aria-label={`${ariaLabel} — taper pour saisir`}
            onClick={(e) => {
              e.stopPropagation()
              if (suppressClick.current) {
                suppressClick.current = false
                return
              }
              openKeypad()
            }}
          >
            —
          </button>
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
              const pulse = isCenter && tickPulse > 0 && !reduced ? 1.04 : 1
              // Center shows the live value (e.g. typed « 70,5 ») even when off-step;
              // a later spin snaps to the nearest wheel step (integers when step=1).
              const label =
                isCenter && value != null ? formatWheelValue(value) : formatWheelValue(v)
              return (
                <div
                  key={`${v}-${idx}`}
                  className="absolute inset-x-0 flex items-center justify-center font-bold tabular-nums"
                  data-testid={isCenter ? 'number-wheel-center' : undefined}
                  data-wheel-tick={isCenter ? tickPulse : undefined}
                  onClick={
                    isCenter
                      ? (ev) => {
                          ev.stopPropagation()
                          if (suppressClick.current) {
                            suppressClick.current = false
                            return
                          }
                          openKeypad()
                        }
                      : undefined
                  }
                  role={isCenter ? 'button' : undefined}
                  aria-label={isCenter ? `${ariaLabel} — taper pour saisir` : undefined}
                  style={{
                    top: idx * ITEM_H,
                    height: ITEM_H,
                    fontSize,
                    color,
                    opacity,
                    transform: `scale(${scale * pulse})`,
                    transition: reduced
                      ? undefined
                      : 'transform 90ms var(--ease-out, cubic-bezier(0.23, 1, 0.32, 1))',
                    letterSpacing: '-0.03em',
                    cursor: isCenter ? 'text' : undefined,
                  }}
                >
                  {label}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {keypadError ? (
        <p
          className="mt-2 text-center text-[13px] text-[#FF6961]"
          role="alert"
          data-testid="number-wheel-error"
        >
          {keypadError}
        </p>
      ) : null}
    </div>
  )
}
