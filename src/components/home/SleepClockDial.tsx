import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
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
/** ViewBox fixe ; affichage ≈ largeur − 80 pt (~320 sur iPhone 17). */
const SIZE = 320
const C = SIZE / 2
/** v12 C Ranked Gym geometry */
const SW = 26
const ARC_W = 20
const HS = 36
const R = C - HS / 2 - 10 // 132
const HANDLE_HIT = HS / 2 + 8
/** Centre typo : bloc « durée + label » un peu plus bas pour centrage optique. */
const CENTER_DURATION_Y = C + 2
const CENTER_LABEL_Y = C + 34

type DragTarget = 'bed' | 'wake' | 'shift'

interface SleepClockDialProps {
  bedtime: string
  waketime: string
  onChange: (next: { bedtime: string; waketime: string }) => void
  /** Appelé à la fin d’un drag (sauvegarde / AlarmKit côté parent). */
  onCommit?: (next: { bedtime: string; waketime: string }) => void
  disabled?: boolean
  /** Display width in px (viewBox stays 320 — scales cleanly). */
  size?: number
}

/** Minute m → degrees clockwise from 12 o’clock (m/1440·360). */
function minutesToAngle(minutes: number): number {
  return (minutes / (24 * 60)) * 360
}

function angleToMinutes(angleDeg: number): number {
  const norm = ((angleDeg % 360) + 360) % 360
  return snapMinutes((norm / 360) * 24 * 60, 5)
}

/** Polar: 0° at top, clockwise — matches m/1440·2π − π/2 in radians. */
function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: C + radius * Math.cos(rad), y: C + radius * Math.sin(rad) }
}

function describeArc(startMin: number, endMin: number, radius: number): string {
  let span = endMin - startMin
  if (span <= 0) span += 24 * 60
  if (span >= 24 * 60 - 1) {
    const a = polar(0, radius)
    const b = polar(180, radius)
    return `M ${a.x} ${a.y} A ${radius} ${radius} 0 1 1 ${b.x} ${b.y} A ${radius} ${radius} 0 1 1 ${a.x} ${a.y}`
  }
  const startAngle = minutesToAngle(startMin)
  const endAngle = minutesToAngle(endMin)
  const large = span > 12 * 60 ? 1 : 0
  const s = polar(startAngle, radius)
  const e = polar(endAngle, radius)
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
}

/** Arc path from startDeg to endDeg (degrees from 12, clockwise), span < 180°. */
function describeDegArc(startDeg: number, endDeg: number, radius: number): string {
  const s = polar(startDeg, radius)
  const e = polar(endDeg, radius)
  let delta = endDeg - startDeg
  if (delta < 0) delta += 360
  const large = delta > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`
}

function pointNearArc(
  x: number,
  y: number,
  bedMin: number,
  wakeMin: number,
  bedPos: { x: number; y: number },
  wakePos: { x: number; y: number },
): boolean {
  const dx = x - C
  const dy = y - C
  const dist = Math.hypot(dx, dy)
  if (Math.abs(dist - R) > SW / 2 + 8) return false
  const dBed = Math.hypot(x - bedPos.x, y - bedPos.y)
  const dWake = Math.hypot(x - wakePos.x, y - wakePos.y)
  if (dBed < HANDLE_HIT || dWake < HANDLE_HIT) return false
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360
  const min = angleToMinutes(angle)
  let span = wakeMin - bedMin
  if (span <= 0) span += 24 * 60
  let fromBed = min - bedMin
  if (fromBed < 0) fromBed += 24 * 60
  return fromBed <= span
}

/** White bed icon — 18×18, stroke 2.2, upright. */
function BedIcon() {
  return (
    <g aria-hidden>
      <path
        d="M3.5 14.5V8.2A1.6 1.6 0 0 1 5.1 6.6H8.2a2.8 2.8 0 0 1 2.8 2.8v1.2h4.4A1.5 1.5 0 0 1 16.9 12v2.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M2.5 14.5h13.5" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="6.2" cy="9.4" r="1.35" fill="#fff" />
    </g>
  )
}

/** White alarm icon — 18×18, stroke 2.2, upright. */
function AlarmIcon() {
  return (
    <g aria-hidden>
      <circle cx="9" cy="10" r="5.1" fill="none" stroke="#fff" strokeWidth="2.2" />
      <path
        d="M9 7.4v2.9l1.9 1.2"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.1 4.1 1.6 5.5M14.9 4.1 16.4 5.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </g>
  )
}

function Handle({
  x,
  y,
  kind,
  filterId,
}: {
  x: number
  y: number
  kind: 'bed' | 'wake'
  filterId: string
}) {
  const half = HS / 2
  const inset = 1.4
  return (
    <g transform={`translate(${x} ${y})`} filter={`url(#${filterId})`}>
      <rect
        x={-half}
        y={-half}
        width={HS}
        height={HS}
        rx={6}
        ry={6}
        fill={RED}
        stroke="rgba(0,0,0,.3)"
        strokeWidth={1.15}
      />
      <rect
        x={-half + inset}
        y={-half + inset}
        width={HS - inset * 2}
        height={HS - inset * 2}
        rx={5}
        ry={5}
        fill="none"
        stroke="rgba(255,255,255,.25)"
        strokeWidth={1}
      />
      <g transform="translate(-9 -9)">{kind === 'bed' ? <BedIcon /> : <AlarmIcon />}</g>
    </g>
  )
}

/**
 * Cadran 24 h v12 C — poignées = une heure ; drag direct sur l’arc = décalage durée fixe.
 */
export function SleepClockDial({
  bedtime,
  waketime,
  onChange,
  onCommit,
  disabled,
  size = SIZE,
}: SleepClockDialProps) {
  const reduced = usePrefersReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragTarget | null>(null)
  const shiftOriginMin = useRef<number | null>(null)
  const shiftStart = useRef<{ bed: number; wake: number; span: number } | null>(null)
  const lastHapticMin = useRef<number | null>(null)
  const latestRef = useRef({ bedtime, waketime })
  latestRef.current = { bedtime, waketime }
  const [shifting, setShifting] = useState(false)

  const bedMin = hmToMinutes(bedtime) ?? 23 * 60
  const wakeMin = hmToMinutes(waketime) ?? 7 * 60
  const tib = computeTibHours(bedtime, waketime)
  const tibLabel = tib != null && tib > 0 ? formatDurationHoursLabel(tib) : '—'

  const bedAngle = minutesToAngle(bedMin)
  const wakeAngle = minutesToAngle(wakeMin)
  const bedPos = polar(bedAngle, R)
  const wakePos = polar(wakeAngle, R)

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
      const angle = ((Math.atan2(pt.y - C, pt.x - C) * 180) / Math.PI + 90 + 360) % 360
      return angleToMinutes(angle)
    },
    [clientToSvg],
  )

  const pickHandle = (clientX: number, clientY: number): 'bed' | 'wake' | null => {
    const pt = clientToSvg(clientX, clientY)
    if (!pt) return null
    const dBed = Math.hypot(pt.x - bedPos.x, pt.y - bedPos.y)
    const dWake = Math.hypot(pt.x - wakePos.x, pt.y - wakePos.y)
    if (dBed <= HANDLE_HIT || dWake <= HANDLE_HIT) {
      return dWake < dBed ? 'wake' : 'bed'
    }
    return null
  }

  const tickHaptic = (minutes: number) => {
    if (lastHapticMin.current === minutes) return
    lastHapticMin.current = minutes
    vibrate(10)
  }

  const applyHandle = (target: 'bed' | 'wake', minutes: number) => {
    const { bedtime: bed, waketime: wake } = latestRef.current
    const other = target === 'bed' ? hmToMinutes(wake) : hmToMinutes(bed)
    if (other != null && minutes === other) return
    tickHaptic(minutes)
    if (target === 'bed') {
      const next = { bedtime: minutesToHm(minutes), waketime: wake }
      latestRef.current = next
      onChange(next)
    } else {
      const next = { bedtime: bed, waketime: minutesToHm(minutes) }
      latestRef.current = next
      onChange(next)
    }
  }

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled) return
    const handle = pickHandle(event.clientX, event.clientY)
    if (handle) {
      event.currentTarget.setPointerCapture(event.pointerId)
      event.preventDefault()
      dragRef.current = handle
      lastHapticMin.current = null
      const minutes = pointerToMinutes(event.clientX, event.clientY)
      if (minutes != null) applyHandle(handle, minutes)
      return
    }

    const pt = clientToSvg(event.clientX, event.clientY)
    const onArc =
      pt != null && pointNearArc(pt.x, pt.y, bedMin, wakeMin, bedPos, wakePos)
    // Hors arc / poignée → laisser le scroll de page (pas de capture).
    if (!onArc) return

    const startMin = pointerToMinutes(event.clientX, event.clientY)
    const span = sleepSpanMinutes(bedtime, waketime)
    if (startMin == null || span == null) return

    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
    shiftOriginMin.current = startMin
    shiftStart.current = { bed: bedMin, wake: wakeMin, span }
    dragRef.current = 'shift'
    lastHapticMin.current = null
    setShifting(true)
    vibrate(14)
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || dragRef.current == null) return
    const minutes = pointerToMinutes(event.clientX, event.clientY)
    if (minutes == null) return

    if (dragRef.current === 'bed' || dragRef.current === 'wake') {
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
      if (next) {
        tickHaptic(hmToMinutes(next.bedtime) ?? minutes)
        latestRef.current = next
        onChange(next)
      }
    }
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const wasDragging = dragRef.current != null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
    shiftOriginMin.current = null
    shiftStart.current = null
    lastHapticMin.current = null
    setShifting(false)
    if (wasDragging) {
      onCommit?.(latestRef.current)
    }
  }

  const trackSegments = Array.from({ length: 48 }, (_, i) => {
    const startDeg = i * 7.5 + 0.675
    const endDeg = startDeg + (7.5 - 1.35)
    return { i, d: describeDegArc(startDeg, endDeg, R) }
  })

  const hourTicks = Array.from({ length: 24 }, (_, h) => {
    const angle = minutesToAngle(h * 60)
    const major = h % 6 === 0
    const startR = R - 13 - 4
    const len = major ? 8 : 5
    const a = polar(angle, startR)
    const b = polar(angle, startR - len)
    return {
      h,
      a,
      b,
      stroke: major ? '#eceeef' : '#636366',
      width: major ? 2 : 1.35,
    }
  })

  const cardinals = [0, 6, 12, 18] as const
  const triangles = cardinals.map((h) => {
    const angle = minutesToAngle(h * 60)
    const tipR = R + 13 + 2
    const tip = polar(angle, tipR)
    const baseR = tipR + 6.2
    const mid = polar(angle, baseR)
    const tang = ((angle - 90) * Math.PI) / 180
    const hx = 4 * Math.cos(tang)
    const hy = 4 * Math.sin(tang)
    const b1 = { x: mid.x + hx, y: mid.y + hy }
    const b2 = { x: mid.x - hx, y: mid.y - hy }
    return { h, tip, b1, b2 }
  })

  const labels = cardinals.map((h) => ({
    h,
    text: String(h),
    pos: polar(minutesToAngle(h * 60), R - 13 - 24),
  }))

  const displaySize = Math.max(180, Math.min(360, Math.round(size)))
  const shadowId = 'sleep-dial-handle-shadow'

  return (
    <div
      className="mx-auto flex flex-col items-center"
      data-sleep-clock-dial
      data-sleep-dial-variant="v12c"
      data-sleep-shifting={shifting ? '1' : '0'}
      data-sleep-dial-size={displaySize}
      data-sleep-dial-drag="arc-immediate"
      style={{ width: displaySize, maxWidth: '100%' }}
    >
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="select-none"
        role="group"
        aria-label="Cadran coucher et réveil"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'pan-y' }}
      >
        <defs>
          <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.1" stdDeviation="1" floodOpacity="0.4" />
          </filter>
        </defs>

        {trackSegments.map((seg) => (
          <path
            key={seg.i}
            d={seg.d}
            fill="none"
            stroke="#353a3d"
            strokeWidth={SW}
            strokeLinecap="butt"
          />
        ))}

        <path
          d={describeArc(bedMin, wakeMin, R)}
          fill="none"
          stroke={RED}
          strokeWidth={shifting && !reduced ? ARC_W + 2 : ARC_W}
          strokeLinecap="butt"
          style={reduced ? undefined : { transition: 'stroke-width 120ms ease' }}
        />

        {triangles.map((t) => (
          <polygon
            key={`tri-${t.h}`}
            points={`${t.tip.x},${t.tip.y} ${t.b1.x},${t.b1.y} ${t.b2.x},${t.b2.y}`}
            fill={RED}
          />
        ))}

        {hourTicks.map((t) => (
          <line
            key={`tick-${t.h}`}
            x1={t.a.x}
            y1={t.a.y}
            x2={t.b.x}
            y2={t.b.y}
            stroke={t.stroke}
            strokeWidth={t.width}
            strokeLinecap="butt"
          />
        ))}

        {labels.map((l) => (
          <text
            key={`lbl-${l.h}`}
            x={l.pos.x}
            y={l.pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="#eceeef"
            fontSize="17"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {l.text}
          </text>
        ))}

        <Handle x={bedPos.x} y={bedPos.y} kind="bed" filterId={shadowId} />
        <Handle x={wakePos.x} y={wakePos.y} kind="wake" filterId={shadowId} />

        <text
          x={C}
          y={CENTER_DURATION_Y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#FFFFFF"
          fontSize="40"
          fontWeight="700"
          fontFamily="system-ui, -apple-system, sans-serif"
          data-sleep-dial-center-duration
        >
          {tibLabel}
        </text>
        <text
          x={C}
          y={CENTER_LABEL_Y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#8E8E93"
          fontSize="14"
          fontFamily="system-ui, -apple-system, sans-serif"
          data-sleep-dial-center-label
        >
          Durée de sommeil
        </text>
      </svg>
    </div>
  )
}
