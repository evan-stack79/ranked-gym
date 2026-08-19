interface SparklineProps {
  points: number[]
  color?: string
  className?: string
}

export function Sparkline({ points, color = '#0A84FF', className = '' }: SparklineProps) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const width = 56
  const height = 24

  const path = points
    .map((value, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((value - min) / range) * height
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-6 w-14 ${className}`}
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  )
}
