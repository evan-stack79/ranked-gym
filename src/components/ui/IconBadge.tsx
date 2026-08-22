import type { LucideIcon } from 'lucide-react'

interface IconBadgeProps {
  icon: LucideIcon
  variant?: 'blue' | 'white' | 'green' | 'orange' | 'crimson' | 'violet' | 'muted'
  size?: 'sm' | 'md'
}

const VARIANTS = {
  blue: 'bg-[#00B4FF]/20 text-[#00B4FF]',
  white: 'bg-white/15 text-white',
  green: 'bg-[#30D158]/20 text-[#30D158]',
  orange: 'bg-[#FF9F0A]/20 text-[#FF9F0A]',
  crimson: 'bg-[#FF2B2B]/20 text-[#FF5C5C]',
  violet: 'bg-[#BF5AF2]/20 text-[#D78FFF]',
  muted: 'bg-[#636366]/25 text-[#8E8E93]',
}

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
}

export function IconBadge({ icon: Icon, variant = 'crimson', size = 'md' }: IconBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-white/10 ${VARIANTS[variant]} ${SIZES[size]}`}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={2} />
    </span>
  )
}
