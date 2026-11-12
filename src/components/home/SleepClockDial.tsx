import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { computeTibHours } from '../../sleep-engine'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import { shiftSleepWindow, sleepSpanMinutes } from '../../utils/sleepDialMath'
import { vibrate } from '../../utils/haptics'
import {
  formatDurationHoursLabel,
  hmToMinutes,
  minutesToHm,
  snapMinutes,
} from '../../utils/sleepTimeFormat'

const RED = '#ff0702'
/** Plus grand + marge pour que 0/6/12/18 h ne soient jamais coupés (iPhone). */
const SIZE = 320
const PAD = 36
const CX = SIZE / 2
const CY = SIZE / 2
const TRACK_R = 102
const HANDLE_R = 17
const LONG_PRESS_MS = 420

type DragTarget = 'bed' | 'wake' | 'shift'

interface SleepClockDialProps {
  bedtime: string
  waketime: string
  onChange: (next: { bedtime: string; waketime: string }) => void
  disabled?: boolean
}

function minutesToAngle(minutes: number): number {
  return (minutes / (24 * 60)) * 360
}

function angleToMinutes(angleDeg: number): number {
  const norm = ((angleDeg % 360) + 360) % 360
  return snapMinutes((norm / 360) * 24 * 60, 5)
}

function polar(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function describeArc(startMin: number, endMin: number, r: number): string {
  let span = endMin - startMin
  if (span <= 0) span += 24 * 60
  if (span >= 24 * 60 - 1) {
    const a = polar(0, r)
    const b = polar(180, r)
    return `M ${a.x} ${a.y} A ${r} ${r} 0 1 1 ${b.x} ${b.y} A ${r} ${r} 0 1 1 ${a.x} ${a.y}`
  }
  const startAngle = minutesToAngle(startMin)
  const endAngle = minutesToAngle(endMin)
  const large = span > 12 * 60 ? 1 : 0
  const s = polar(startAngle, r)
  const e = polar(endAngle, r)
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

function pointNearArc(
  x: number,
  y: number,
  bedMin: number,
  wakeMin: number,
  bedPos: { x: number; y: number },
  wakePos: { x: number; y: number },
): boolean {
  const dx = x - CX
  const dy = y - CY
  const dist = Math.hypot(dx, dy)
  if (Math.abs(dist - TRACK_R) > 22) return false
  const dBed = Math.hypot(x - bedPos.x, y - bedPos.y)
  const dWake = Math.hypot(x - wakePos.x, y - wakePos.y)
  if (dBed < HANDLE_R + 10 || dWake < HANDLE_R + 10) return false
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
  const min = angleToMinutes(angle)
  let span = wakeMin - bedMin
  if (span <= 0) span += 24 * 60
  let fromBed = min - bedMin
  if (fromBed < 0) fromBed += 24 * 60
  return fromBed <= span
}

/** Lit — icône Coucher (cercle blanc). */
function BedIcon({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x - 9} ${y - 9})`} aria-hidden>
      <path
        d="M2 14V7.5A1.5 1.5 0 0 1 3.5 6H7a3 3 0 0 1 3 3v1h5.5A1.5 1.5 0 0 1 17 11.5V14"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 14h16"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="5.2" cy="9.2" r="1.5" fill={color} />
    </g>
  )
}

/** Alarme — icône Réveil (cercle rouge). */
function AlarmIcon({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g transform={`translate(${x - 9} ${y - 9})`} aria-hidden>
      <circle cx="9" cy="10" r="5.2" fill="none" stroke={color} strokeWidth="1.7" />
      <path
        d="M9 7.6v2.8l1.8 1.2"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.2 4.2 1.6 5.6M14.8 4.2 16.4 5.6"
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </g>
  )
}

/**
 * Cadran 24 h — poignées = une heure ; appui long sur l’arc = décalage durée fixe.
 */
export function SleepClockDial({ bedtime, waketime, onChange, disabled }: SleepClockDialProps) {
  const reduced = usePrefersReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragTarget | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const shiftOriginMin = useRef<number | null>(null)
  const shiftStart = useRef<{ bed: number; wake: number; span: number } | null>(null)
  const [shifting, setShifting] = useState(false)

  const bedMin = hmToMinutes(bedtime) ?? 23 * 60
  const wakeMin = hmToMinutes(waketime) ?? 7 * 60
  const tib = computeTibHours(bedtime, waketime)
  const tibLabel = tib != null && tib > 0 ? formatDurationHoursLabel(tib) : '—'

  const bedAngle = minutesToAngle(bedMin)
  const wakeAngle = minutesToAngle(wakeMin)
  const bedPos = polar(bedAngle, TRACK_R)
  const wakePos = polar(wakeAngle, TRACK_R)

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current != null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  useEffect(() => () => clearLongPress(), [clearLongPress])

  const clientToSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * SIZE,
      y: ((clientY - rect.top) / rect.height) * SIZE,
    }
  }, [])

  const pointerToMinutes = useCallback(
    (clientX: number, clientY: number) => {
      const pt = clientToSvg(clientX, clientY)
      if (!pt) return null
      const angle = ((Math.atan2(pt.y - CY, pt.x - CX) * 180) / Math.PI + 90 + 360) % 360
      return angleToMinutes(angle)
    },
    [clientToSvg],
  )

  const pickHandle = (clientX: number, clientY: number): 'bed' | 'wake' | null => {
    const pt = clientToSvg(clientX, clientY)
    if (!pt) return null
    const dBed = Math.hypot(pt.x - bedPos.x, pt.y - bedPos.y)
    const dWake = Math.hypot(pt.x - wakePos.x, pt.y - wakePos.y)
    if (dBed <= HANDLE_R + 14 || dWake <= HANDLE_R + 14) {
      return dWake < dBed ? 'wake' : 'bed'
    }
    return null
  }

  const applyHandle = (target: 'bed' | 'wake', minutes: number) => {
    if (target === 'bed') {
      if (minutes === wakeMin) return
      onChange({ bedtime: minutesToHm(minutes), waketime })
    } else {
      if (minutes === bedMin) return
      onChange({ bedtime, waketime: minutesToHm(minutes) })
    }
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const handle = pickHandle(event.clientX, event.clientY)
    if (handle) {
      dragRef.current = handle
      const minutes = pointerToMinutes(event.clientX, event.clientY)
      if (minutes != null) applyHandle(handle, minutes)
      return
    }

    const pt = clientToSvg(event.clientX, event.clientY)
    const onArc =
      pt != null && pointNearArc(pt.x, pt.y, bedMin, wakeMin, bedPos, wakePos)
    if (!onArc) return

    const startMin = pointerToMinutes(event.clientX, event.clientY)
    const span = sleepSpanMinutes(bedtime, waketime)
    if (startMin == null || span == null) return

    shiftOriginMin.current = startMin
    shiftStart.current = { bed: bedMin, wake: wakeMin, span }
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => {
      dragRef.current = 'shift'
      setShifting(true)
      vibrate(14)
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return
    const minutes = pointerToMinutes(event.clientX, event.clientY)
    if (minutes == null) return

    if (dragRef.current === 'bed' || dragRef.current === 'wake') {
      clearLongPress()
      applyHandle(dragRef.current, minutes)
      return
    }

    if (dragRef.current === 'shift' && shiftOriginMin.current != null && shiftStart.current) {
      let delta = minutes - shiftOriginMin.current
      if (delta > 12 * 60) delta -= 24 * 60
      if (delta < -12 * 60) delta += 24 * 60
      const next = shiftSleepWindow(
        minutesToHm(shiftStart.current.bed),
        minutesToHm(shiftStart.current.wake),
        delta,
      )
      if (next) onChange(next)
      return
    }

    // Moved before long-press fired → cancel shift intent
    if (longPressTimer.current != null && shiftOriginMin.current != null) {
      const moved = Math.abs(minutes - shiftOriginMin.current)
      if (moved > 8) clearLongPress()
    }
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    clearLongPress()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    shiftOriginMin.current = null
    shiftStart.current = null
    setShifting(false)
  }

  const ticks = Array.from({ length: 48 }, (_, i) => {
    const minutes = i * 30
    const angle = minutesToAngle(minutes)
    const major = minutes % 60 === 0
    const hourMajor = minutes % (6 * 60) === 0
    const outer = polar(angle, TRACK_R + (hourMajor ? 12 : major ? 9 : 6))
    const inner = polar(angle, TRACK_R - (hourMajor ? 10 : major ? 6 : 3))
    return { i, outer, inner, major, hourMajor }
  })

  const labels = [
    { h: 0, text: '0' },
    { h: 6, text: '6' },
    { h: 12, text: '12' },
    { h: 18, text: '18' },
  ].map((l) => ({
    ...l,
    pos: polar(minutesToAngle(l.h * 60), TRACK_R + PAD - 8),
  }))

  return (
    <div className="flex flex-col items-center" data-sleep-clock-dial data-sleep-shifting={shifting ? '1' : '0'}>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="max-w-[320px] touch-none select-none"
        role="group"
        aria-label="Cadran coucher et réveil"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <circle
          cx={CX}
          cy={CY}
          r={TRACK_R}
          fill="#1C1C1E"
          stroke={shifting ? 'rgba(255,7,2,0.45)' : '#2C2C2E'}
          strokeWidth={shifting ? 16 : 14}
        />

        {ticks.map((t) => (
          <line
            key={t.i}
            x1={t.inner.x}
            y1={t.inner.y}
            x2={t.outer.x}
            y2={t.outer.y}
            stroke={
              t.hourMajor
                ? 'rgba(255,255,255,0.55)'
                : t.major
                  ? 'rgba(255,255,255,0.28)'
                  : 'rgba(255,255,255,0.12)'
            }
            strokeWidth={t.hourMajor ? 1.6 : 1}
            strokeLinecap="round"
          />
        ))}

        {labels.map((l) => (
          <text
            key={l.h}
            x={l.pos.x}
            y={l.pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.72)"
            fontSize="13"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {l.text}
          </text>
        ))}

        <path
          d={describeArc(bedMin, wakeMin, TRACK_R)}
          fill="none"
          stroke={RED}
          strokeWidth={shifting ? 16 : 14}
          strokeLinecap="round"
          opacity={shifting ? 1 : 0.95}
          style={reduced ? undefined : { transition: 'stroke-width 120ms ease' }}
        />

        {/* Coucher : rond blanc + lit */}
        <circle cx={bedPos.x} cy={bedPos.y} r={HANDLE_R} fill="#FFFFFF" />
        <BedIcon x={bedPos.x} y={bedPos.y} color="#1C1C1E" />

        {/* Réveil : rond rouge + alarme */}
        <circle cx={wakePos.x} cy={wakePos.y} r={HANDLE_R} fill={RED} />
        <AlarmIcon x={wakePos.x} y={wakePos.y} color="#FFFFFF" />

        <text
          x={CX}
          y={CY - 10}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="34"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {tibLabel}
        </text>
        <text
          x={CX}
          y={CY + 18}
          textAnchor="middle"
          fill="#8E8E93"
          fontSize="13"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          Durée de sommeil
        </text>
      </svg>
    </div>
  )
}
