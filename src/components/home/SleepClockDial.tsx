import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { computeTibHours } from '../../sleep-engine'
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion'
import {
  formatDurationHoursLabel,
  hmToMinutes,
  minutesToHm,
  snapMinutes,
} from '../../utils/sleepTimeFormat'

const RED = '#ff0702'
const SIZE = 280
const CX = SIZE / 2
const CY = SIZE / 2
const TRACK_R = 108
const HANDLE_R = 18

type DragTarget = 'bed' | 'wake'

interface SleepClockDialProps {
  bedtime: string
  waketime: string
  onChange: (next: { bedtime: string; waketime: string }) => void
  disabled?: boolean
}

function minutesToAngle(minutes: number): number {
  // 0 h at top, clockwise
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
  // Full circle edge case
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

function MoonIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 8} ${y - 8})`} aria-hidden>
      <path
        d="M10.2 2.2a6.8 6.8 0 1 0 7.6 9.4A5.6 5.6 0 0 1 10.2 2.2Z"
        fill={RED}
      />
    </g>
  )
}

function SunIcon({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x - 9} ${y - 9})`} aria-hidden>
      <circle cx="9" cy="9" r="3.2" fill={RED} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 9 + Math.cos(rad) * 5.2
        const y1 = 9 + Math.sin(rad) * 5.2
        const x2 = 9 + Math.cos(rad) * 7.6
        const y2 = 9 + Math.sin(rad) * 7.6
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={RED}
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

/**
 * Cadran 24 h — lune = coucher, soleil = lever.
 * Centre : durée « au lit ». Respecte prefers-reduced-motion (pas d’anim curseur).
 */
export function SleepClockDial({ bedtime, waketime, onChange, disabled }: SleepClockDialProps) {
  const reduced = usePrefersReducedMotion()
  const svgRef = useRef<SVGSVGElement>(null)
  const dragRef = useRef<DragTarget | null>(null)

  const bedMin = hmToMinutes(bedtime) ?? 23 * 60
  const wakeMin = hmToMinutes(waketime) ?? 7 * 60
  const tib = computeTibHours(bedtime, waketime)
  const tibLabel = tib != null && tib > 0 ? formatDurationHoursLabel(tib) : '—'

  const bedAngle = minutesToAngle(bedMin)
  const wakeAngle = minutesToAngle(wakeMin)
  const bedPos = polar(bedAngle, TRACK_R)
  const wakePos = polar(wakeAngle, TRACK_R)

  const pointerToMinutes = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current
    if (!svg) return null
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * SIZE - CX
    const y = ((clientY - rect.top) / rect.height) * SIZE - CY
    const angle = ((Math.atan2(y, x) * 180) / Math.PI + 90 + 360) % 360
    return angleToMinutes(angle)
  }, [])

  const pickTarget = (clientX: number, clientY: number): DragTarget => {
    const svg = svgRef.current
    if (!svg) return 'bed'
    const rect = svg.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * SIZE
    const y = ((clientY - rect.top) / rect.height) * SIZE
    const dBed = Math.hypot(x - bedPos.x, y - bedPos.y)
    const dWake = Math.hypot(x - wakePos.x, y - wakePos.y)
    return dWake < dBed ? 'wake' : 'bed'
  }

  const applyDrag = (target: DragTarget, minutes: number) => {
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
    const target = pickTarget(event.clientX, event.clientY)
    dragRef.current = target
    const minutes = pointerToMinutes(event.clientX, event.clientY)
    if (minutes != null) applyDrag(target, minutes)
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (disabled || !dragRef.current) return
    const minutes = pointerToMinutes(event.clientX, event.clientY)
    if (minutes != null) applyDrag(dragRef.current, minutes)
  }

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    dragRef.current = null
  }

  const ticks = Array.from({ length: 24 }, (_, h) => {
    const angle = minutesToAngle(h * 60)
    const outer = polar(angle, TRACK_R + 10)
    const inner = polar(angle, TRACK_R - (h % 6 === 0 ? 14 : 8))
    return { h, outer, inner, major: h % 6 === 0 }
  })

  const labels = [
    { h: 0, text: '0 h' },
    { h: 6, text: '6 h' },
    { h: 12, text: '12 h' },
    { h: 18, text: '18 h' },
  ].map((l) => ({ ...l, pos: polar(minutesToAngle(l.h * 60), TRACK_R + 28) }))

  return (
    <div className="flex flex-col items-center" data-sleep-clock-dial>
      <svg
        ref={svgRef}
        width="100%"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="max-w-[300px] touch-none select-none"
        role="group"
        aria-label="Cadran coucher et lever"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{ touchAction: 'none' }}
      >
        <circle cx={CX} cy={CY} r={TRACK_R} fill="#1C1C1E" stroke="#2C2C2E" strokeWidth={14} />

        {ticks.map((t) => (
          <line
            key={t.h}
            x1={t.inner.x}
            y1={t.inner.y}
            x2={t.outer.x}
            y2={t.outer.y}
            stroke={t.major ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'}
            strokeWidth={t.major ? 2 : 1.2}
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
            fill="rgba(255,255,255,0.7)"
            fontSize="12"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            {l.text}
          </text>
        ))}

        <path
          d={describeArc(bedMin, wakeMin, TRACK_R)}
          fill="none"
          stroke={RED}
          strokeWidth={14}
          strokeLinecap="round"
          style={
            reduced
              ? undefined
              : { transition: 'd 80ms linear' }
          }
        />

        <circle cx={bedPos.x} cy={bedPos.y} r={HANDLE_R} fill="#F5F5F7" />
        <MoonIcon x={bedPos.x} y={bedPos.y} />

        <circle cx={wakePos.x} cy={wakePos.y} r={HANDLE_R} fill="#F5F5F7" />
        <SunIcon x={wakePos.x} y={wakePos.y} />

        <text
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="28"
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
          fontSize="14"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          au lit
        </text>
      </svg>
      <p className="mt-1 text-center text-[12px] text-[#8E8E93]">Glisse la lune et le soleil.</p>
    </div>
  )
}
