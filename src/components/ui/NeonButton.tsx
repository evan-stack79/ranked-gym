import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface NeonButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  variant?: 'green' | 'blue'
  className?: string
}

export function NeonButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  loadingLabel = 'Chargement...',
  variant = 'green',
  className = '',
}: NeonButtonProps) {
  const glowClass = variant === 'green' ? 'neon-glow-green' : 'neon-glow-blue'
  const gradientClass =
    variant === 'green'
      ? 'from-neon-green/20 to-neon-green/5 hover:from-neon-green/30'
      : 'from-neon-blue/20 to-neon-blue/5 hover:from-neon-blue/30'
  const borderClass = variant === 'green' ? 'border-neon-green/50' : 'border-neon-blue/50'
  const textClass = variant === 'green' ? 'text-neon-green' : 'text-neon-blue'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full rounded-2xl border bg-gradient-to-b px-6 py-5 text-lg font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${glowClass} ${gradientClass} ${borderClass} ${textClass} ${className}`}
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          {loadingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  )
}
