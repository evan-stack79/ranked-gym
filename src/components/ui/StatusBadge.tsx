interface StatusBadgeProps {
  variant?: 'fire' | 'elite' | 'legend' | 'hot'
  label?: string
}

const VARIANTS = {
  fire: {
    label: 'EN FEU 🔥',
    className: 'bg-[#FF3B30]/20 text-[#FF6961] border-[#FF3B30]/30',
  },
  elite: {
    label: 'ÉLITE',
    className: 'bg-[#BF5AF2]/20 text-[#E0A8FF] border-[#BF5AF2]/35',
  },
  legend: {
    label: 'LÉGENDE',
    className: 'bg-[#FFD60A]/20 text-[#FFD60A] border-[#FFD60A]/40',
  },
  hot: {
    label: 'STREAK',
    className: 'bg-[#FF9F0A]/20 text-[#FFB340] border-[#FF9F0A]/30',
  },
}

export function StatusBadge({ variant = 'fire', label }: StatusBadgeProps) {
  const config = VARIANTS[variant]

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-wide ${config.className}`}
    >
      {label ?? config.label}
    </span>
  )
}

/** Pick a vivid status chip from level / rank for lobby & profile. */
export function statusFromPower(level: number, rank?: string): StatusBadgeProps['variant'] | null {
  if (rank === 'Légende' || level >= 70) return 'legend'
  if (rank === 'Diamant' || rank === 'Master' || level >= 55) return 'elite'
  if (level >= 40) return 'fire'
  if (level >= 25) return 'hot'
  return null
}
