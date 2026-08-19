import type { LucideIcon } from 'lucide-react'

interface IconBadgeProps {
  icon: LucideIcon
  variant?: 'blue' | 'white' | 'green' | 'orange'
  size?: 'sm' | 'md'
}

const VARIANTS = {
  blue: 'bg-[#0A84FF]/15 text-[#0A84FF]',
  white: 'bg-white/10 text-white',
  green: 'bg-[#30D158]/15 text-[#30D158]',
  orange: 'bg-[#FF9F0A]/15 text-[#FF9F0A]',
}

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
}

export function IconBadge({ icon: Icon, variant = 'blue', size = 'md' }: IconBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border border-white/5 ${VARIANTS[variant]} ${SIZES[size]}`}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} strokeWidth={1.75} />
    </span>
  )
}
