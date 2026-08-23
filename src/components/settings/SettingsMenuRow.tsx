import type { LucideIcon } from 'lucide-react'
import { ChevronRight } from 'lucide-react'

interface SettingsMenuRowProps {
  icon: LucideIcon
  label: string
  onClick?: () => void
  showChevron?: boolean
}

export function SettingsMenuRow({
  icon: Icon,
  label,
  onClick,
  showChevron = true,
}: SettingsMenuRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ios-press flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-white/[0.04]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.06] text-[#EBEBF5]">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-medium text-white">{label}</span>
      {showChevron && (
        <ChevronRight className="h-5 w-5 shrink-0 text-[#636366]" strokeWidth={2} />
      )}
    </button>
  )
}
