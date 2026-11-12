import type { CSSProperties } from 'react'

const RED = '#ff0702'

/** Icônes lune / soleil identiques partout (Marketing §9). */
export function SleepMoonIcon({
  size = 14,
  className = '',
  color = RED,
}: {
  size?: number
  className?: string
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ color } as CSSProperties}
    >
      <path
        fill="currentColor"
        d="M12.2 2.1a9.2 9.2 0 1 0 9.7 12.1A7.5 7.5 0 0 1 12.2 2.1Z"
      />
    </svg>
  )
}

export function SleepSunIcon({
  size = 14,
  className = '',
  color = RED,
}: {
  size?: number
  className?: string
  color?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      style={{ color } as CSSProperties}
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180
        return (
          <line
            key={deg}
            x1={12 + Math.cos(rad) * 6.2}
            y1={12 + Math.sin(rad) * 6.2}
            x2={12 + Math.cos(rad) * 9.2}
            y2={12 + Math.sin(rad) * 9.2}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        )
      })}
    </svg>
  )
}
