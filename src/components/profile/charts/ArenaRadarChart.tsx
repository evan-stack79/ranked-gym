/** Radar / spider chart — axes combat (Upper, Lower, Force, Volume, Régularité). */

export const RADAR_AXIS_LABELS = {
  regularity: 'Régularité',
} as const

export type ArenaRadarAxis = {
  label: string
  value: number
}

interface ArenaRadarChartProps {
  axes?: ArenaRadarAxis[]
  className?: string
  loading?: boolean
}

const DEFAULT_AXES: ArenaRadarAxis[] = [
  { label: 'Upper', value: 74 },
  { label: 'Lower', value: 68 },
  { label: 'Force', value: 82 },
  { label: 'Volume', value: 61 },
  { label: RADAR_AXIS_LABELS.regularity, value: 77 },
]

const SIZE = 260
const CX = SIZE / 2
const CY = SIZE / 2
const MAX_R = 88
const LEVELS = [0.25, 0.5, 0.75, 1]

function axisPoint(index: number, count: number, radius: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count
  return [CX + radius * Math.cos(angle), CY + radius * Math.sin(angle)]
}

function polygonPath(values: number[], count: number, scale: number): string {
  return values
    .map((value, i) => {
      const r = (Math.min(100, Math.max(0, value)) / 100) * MAX_R * scale
      const [x, y] = axisPoint(i, count, r)
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
    .concat(' Z')
}

export function ArenaRadarChart({
  axes = DEFAULT_AXES,
  className = '',
  loading = false,
}: ArenaRadarChartProps) {
  if (loading) {
    return (
      <div className={`flex min-h-[260px] items-center justify-center ${className}`}>
        <div className="avatar-spinner h-8 w-8 rounded-full border-2 border-white/20 border-t-[#FF2B2B]" aria-label="Chargement du radar" />
      </div>
    )
  }

  const displayAxes = axes.map((axis) =>
    axis.label.toLowerCase().includes('gularit')
      ? { ...axis, label: RADAR_AXIS_LABELS.regularity }
      : axis,
  )
  const count = displayAxes.length
  const gridPolygons = LEVELS.map((level) => polygonPath(Array(count).fill(100), count, level))
  const dataPath = polygonPath(
    displayAxes.map((a) => a.value),
    count,
    1,
  )

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="mx-auto h-auto w-full max-w-[280px]"
        role="img"
        aria-label="Bilan de l'arène — graphique radar"
      >
        <defs>
          <linearGradient id="arena-radar-fill" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF2B2B" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FF2B2B" stopOpacity="0.12" />
          </linearGradient>
          <filter id="arena-radar-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {gridPolygons.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={i === gridPolygons.length - 1 ? 1.25 : 1}
          />
        ))}

        {axes.map((_, i) => {
          const [x, y] = axisPoint(i, count, MAX_R)
          return (
            <line
              key={i}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          )
        })}

        <path d={dataPath} fill="url(#arena-radar-fill)" stroke="none" />
        <path
          d={dataPath}
          fill="none"
          stroke="#FF2B2B"
          strokeWidth={2.25}
          strokeLinejoin="round"
          filter="url(#arena-radar-glow)"
        />

        {displayAxes.map((axis, i) => {
          const r = (axis.value / 100) * MAX_R
          const [x, y] = axisPoint(i, count, r)
          return (
            <circle key={axis.label} cx={x} cy={y} r={3.5} fill="#FF6961" stroke="#0C0C0E" strokeWidth={1.5} />
          )
        })}

        {displayAxes.map((axis, i) => {
          const [x, y] = axisPoint(i, count, MAX_R + 22)
          return (
            <text
              key={`label-${axis.label}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-[#AEAEB2] text-[10px] font-semibold uppercase tracking-wide"
              style={{ fontSize: 10 }}
            >
              {axis.label}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
