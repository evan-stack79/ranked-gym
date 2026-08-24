import type { LucideIcon } from 'lucide-react'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

interface ProfileSubScreenHeaderProps {
  title: string
  subtitle?: string
  onBack: () => void
  trailing?: ReactNode
}

export function ProfileSubScreenHeader({
  title,
  subtitle,
  onBack,
  trailing,
}: ProfileSubScreenHeaderProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        className="ios-press flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-[#EBEBF5]"
        aria-label="Retour"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
      </button>
      <div className="min-w-0 flex-1">
        <h1 className="text-[20px] font-bold tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="text-[13px] text-[#8E8E93]">{subtitle}</p> : null}
      </div>
      {trailing}
    </div>
  )
}

interface SettingsActionRowProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  danger?: boolean
  showChevron?: boolean
}

export function SettingsActionRow({
  icon: Icon,
  label,
  onClick,
  danger = false,
  showChevron = true,
}: SettingsActionRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ios-press flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[0.04] ${
        danger ? 'text-[#FF6961]' : 'text-white'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          danger ? 'bg-[#FF453A]/15 text-[#FF6961]' : 'bg-white/[0.06] text-[#EBEBF5]'
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-medium">{label}</span>
      {showChevron ? (
        <span className={`text-[18px] ${danger ? 'text-[#FF6961]/60' : 'text-[#636366]'}`}>›</span>
      ) : null}
    </button>
  )
}
