import type { ReactNode } from 'react'

interface MacroRingProps {
  progress: number
  size?: number
  stroke?: number
  color: string
  trackColor?: string
  children?: ReactNode
}

export function MacroRing({
  progress,
  size = 88,
  stroke = 8,
  color,
  trackColor = 'rgb(255 255 255 / 0.08)',
  children,
}: MacroRingProps) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(progress, 0), 1.15)
  const offset = circumference * (1 - Math.min(clamped, 1))

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            filter: `drop-shadow(0 0 6px ${color}88)`,
            transition: 'stroke-dashoffset 0.6s ease',
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
