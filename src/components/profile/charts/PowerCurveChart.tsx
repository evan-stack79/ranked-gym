/** Courbe de puissance — évolution 1RM Développé couché (données factices). */

export type PowerCurvePoint = {
  label: string
  valueKg: number
}

interface PowerCurveChartProps {
  points?: PowerCurvePoint[]
  exerciseLabel?: string
  className?: string
}

const DEFAULT_POINTS: PowerCurvePoint[] = [
  { label: 'S-3', valueKg: 80 },
  { label: 'S-2', valueKg: 82.5 },
  { label: 'S-1', valueKg: 85 },
  { label: 'Act.', valueKg: 87.5 },
]

const W = 320
const H = 148
const PAD = { top: 16, right: 12, bottom: 28, left: 36 }
const INNER_W = W - PAD.left - PAD.right
const INNER_H = H - PAD.top - PAD.bottom

function buildPath(
  points: PowerCurvePoint[],
  minY: number,
  maxY: number,
): string {
  const range = maxY - minY || 1
  return points
    .map((p, i) => {
      const x = PAD.left + (i / Math.max(points.length - 1, 1)) * INNER_W
      const y = PAD.top + INNER_H - ((p.valueKg - minY) / range) * INNER_H
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function buildArea(
  points: PowerCurvePoint[],
  minY: number,
  maxY: number,
): string {
  const line = buildPath(points, minY, maxY)
  const lastX = PAD.left + INNER_W
  const baseY = PAD.top + INNER_H
  const firstX = PAD.left
  return `${line} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`
}

export function PowerCurveChart({
  points = DEFAULT_POINTS,
  exerciseLabel = 'Développé couché',
  className = '',
}: PowerCurveChartProps) {
  const values = points.map((p) => p.valueKg)
  const minY = Math.floor(Math.min(...values) - 5)
  const maxY = Math.ceil(Math.max(...values) + 3)
  const range = maxY - minY || 1
  const gridSteps = 3

  const linePath = buildPath(points, minY, maxY)
  const areaPath = buildArea(points, minY, maxY)

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Courbe de puissance — ${exerciseLabel}`}
      >
        <defs>
          <linearGradient id="power-curve-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF2B2B" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#FF2B2B" stopOpacity="0" />
          </linearGradient>
          <filter id="power-curve-neon" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const y = PAD.top + (i / gridSteps) * INNER_H
          const val = maxY - (i / gridSteps) * range
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
                strokeDasharray={i === gridSteps ? undefined : '4 4'}
              />
              <text
                x={PAD.left - 6}
                y={y + 3}
                textAnchor="end"
                className="fill-[#636366]"
                style={{ fontSize: 9 }}
              >
                {Math.round(val)}
              </text>
            </g>
          )
        })}

        <path d={areaPath} fill="url(#power-curve-area)" />
        <path
          d={linePath}
          fill="none"
          stroke="#FF2B2B"
          strokeWidth={2.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#power-curve-neon)"
        />

        {points.map((p, i) => {
          const x = PAD.left + (i / Math.max(points.length - 1, 1)) * INNER_W
          const y = PAD.top + INNER_H - ((p.valueKg - minY) / range) * INNER_H
          return (
            <g key={p.label}>
              <circle cx={x} cy={y} r={4.5} fill="#FF2B2B" stroke="#0C0C0E" strokeWidth={2} />
              <text
                x={x}
                y={H - 8}
                textAnchor="middle"
                className="fill-[#8E8E93]"
                style={{ fontSize: 10, fontWeight: 600 }}
              >
                {p.label}
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-1 flex items-center justify-between px-1">
        <p className="text-[12px] text-[#8E8E93]">{exerciseLabel} · 1RM estimé</p>
        <p className="text-[13px] font-bold tabular-nums text-[#FF6961]">
          {points[points.length - 1]?.valueKg} kg
        </p>
      </div>
    </div>
  )
}
