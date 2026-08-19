const AVATAR_COLORS = [
  'bg-[#3A3A3C]',
  'bg-[#48484A]',
  'bg-[#636366]',
  'bg-[#2C2C2E]',
  'bg-[#1C1C1E]',
]

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash)
}

interface AvatarProps {
  username: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({ username, size = 'md', className = '' }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase()
  const bg = AVATAR_COLORS[hashString(username) % AVATAR_COLORS.length]

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${bg} ${sizeClasses[size]} ${className}`}
      aria-label={`Avatar de ${username}`}
    >
      {initials}
    </div>
  )
}
