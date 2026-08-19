import type { ReactNode } from 'react'
import { Loader2 } from 'lucide-react'

interface NeonButtonProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  variant?: 'primary' | 'secondary' | 'destructive'
  className?: string
}

export function NeonButton({
  children,
  onClick,
  disabled = false,
  loading = false,
  loadingLabel = 'Chargement...',
  variant = 'primary',
  className = '',
}: NeonButtonProps) {
  const variantClass = {
    primary: 'bg-[#0A84FF] text-white active:opacity-80',
    secondary: 'bg-[#1C1C1E] text-white active:bg-[#2C2C2E]',
    destructive: 'bg-[#1C1C1E] text-[#FF453A] active:bg-[#2C2C2E]',
  }[variant]

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full rounded-2xl px-6 py-4 text-[17px] font-semibold tracking-tight transition-opacity disabled:cursor-not-allowed disabled:opacity-40 ${variantClass} ${className}`}
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
