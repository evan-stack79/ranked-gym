const AVATAR_GRADIENTS = [
  'from-neon-green/80 to-neon-blue/80',
  'from-neon-blue/80 to-neon-purple/80',
  'from-neon-purple/80 to-pink-500/80',
  'from-orange-500/80 to-neon-green/80',
  'from-cyan-500/80 to-blue-600/80',
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
  xl: 'h-24 w-24 text-3xl',
}

export function Avatar({ username, size = 'md', className = '' }: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase()
  const gradient = AVATAR_GRADIENTS[hashString(username) % AVATAR_GRADIENTS.length]

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white/10 ${gradient} ${sizeClasses[size]} ${className}`}
      aria-label={`Avatar de ${username}`}
    >
      {initials}
    </div>
  )
}
