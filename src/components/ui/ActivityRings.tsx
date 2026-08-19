interface ActivityRingsProps {
  values: [number, number, number]
  size?: number
}

const RING_COLORS = ['#FF453A', '#30D158', '#0A84FF']

export function ActivityRings({ values, size = 36 }: ActivityRingsProps) {
  const center = size / 2
  const rings = [
    { radius: size * 0.42, width: 2.5 },
    { radius: size * 0.32, width: 2.5 },
    { radius: size * 0.22, width: 2.5 },
  ]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      {rings.map((ring, index) => {
        const circumference = 2 * Math.PI * ring.radius
        const progress = Math.min(Math.max(values[index], 0), 1)
        const offset = circumference * (1 - progress)

        return (
          <g key={index}>
            <circle
              cx={center}
              cy={center}
              r={ring.radius}
              fill="none"
              stroke="rgb(255 255 255 / 0.08)"
              strokeWidth={ring.width}
            />
            <circle
              cx={center}
              cy={center}
              r={ring.radius}
              fill="none"
              stroke={RING_COLORS[index]}
              strokeWidth={ring.width}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${center} ${center})`}
              opacity="0.9"
            />
          </g>
        )
      })}
    </svg>
  )
}
