import type { LucideIcon } from 'lucide-react'
import { BookOpen, Camera, ScanBarcode, Search, Sparkles } from 'lucide-react'

export type NutritionQuickActionId = 'scanner' | 'scan-ia' | 'search' | 'journal'

interface NutritionQuickActionsProps {
  onAction: (id: NutritionQuickActionId) => void
}

function ScanIaIcon({ className }: { className?: string }) {
  return (
    <span className={`relative inline-flex ${className ?? ''}`} aria-hidden>
      <Camera className="h-6 w-6" strokeWidth={1.75} />
      <Sparkles
        className="absolute -right-1.5 -top-1.5 h-3 w-3"
        strokeWidth={2.25}
        fill="currentColor"
      />
    </span>
  )
}

const ACTIONS: Array<{
  id: NutritionQuickActionId
  label: string
  Icon?: LucideIcon
  customIcon?: 'scan-ia'
}> = [
  { id: 'scanner', label: 'Scanner', Icon: ScanBarcode },
  { id: 'scan-ia', label: 'Scan IA', customIcon: 'scan-ia' },
  { id: 'search', label: 'Recherche', Icon: Search },
  { id: 'journal', label: 'Journal', Icon: BookOpen },
]

export function NutritionQuickActions({ onAction }: NutritionQuickActionsProps) {
  return (
    <div className="grid grid-cols-4 gap-2 px-1" role="group" aria-label="Raccourcis nutrition">
      {ACTIONS.map(({ id, label, Icon, customIcon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onAction(id)}
          className="ios-press flex flex-col items-center gap-2 py-1 text-[#FF2B2B]"
        >
          <span className="flex h-11 w-11 items-center justify-center">
            {customIcon === 'scan-ia' ? (
              <ScanIaIcon />
            ) : Icon ? (
              <Icon className="h-6 w-6" strokeWidth={1.75} />
            ) : null}
          </span>
          <span className="text-[12px] font-medium text-white">{label}</span>
        </button>
      ))}
    </div>
  )
}
