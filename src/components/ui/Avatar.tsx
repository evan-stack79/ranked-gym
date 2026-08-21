const AVATAR_COLORS = [
  'bg-ios-inset',
  'bg-[#48484A]',
  'bg-[#636366]',
  'bg-ios-surface',
  'bg-[#48484A]',
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
  /** Public URL — si absente, fallback initiales. */
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  /** Spinner discret pendant l’upload. */
  loading?: boolean
}

const sizeClasses = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-20 w-20 text-2xl',
}

export function Avatar({
  username,
  imageUrl,
  size = 'md',
  className = '',
  loading = false,
}: AvatarProps) {
  const initials = username.slice(0, 2).toUpperCase()
  const bg = AVATAR_COLORS[hashString(username) % AVATAR_COLORS.length]
  const hasPhoto = Boolean(imageUrl)

  return (
    <div
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${
        hasPhoto ? 'bg-[#1C1C1E]' : bg
      } ${sizeClasses[size]} ${className}`}
      aria-label={`Avatar de ${username}`}
      aria-busy={loading || undefined}
    >
      {hasPhoto ? (
        <img
          src={imageUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="relative z-[1]">{initials}</span>
      )}

      {loading ? (
        <span
          className="absolute inset-0 z-[2] flex items-center justify-center bg-black/45"
          aria-hidden
        >
          <span className="avatar-spinner h-5 w-5 rounded-full border-2 border-white/25 border-t-white" />
        </span>
      ) : null}
    </div>
  )
}
