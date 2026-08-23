import { EyeOff } from 'lucide-react'
import { IconBadge } from '../ui/IconBadge'

interface GhostModeToggleProps {
  enabled: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

export function GhostModeToggle({ enabled, onChange, disabled = false }: GhostModeToggleProps) {
  return (
    <section className="glass-card rounded-2xl px-5 py-4">
      <div className="flex flex-row items-center justify-between gap-3">
        <IconBadge icon={EyeOff} variant="violet" size="sm" />
        <div className="min-w-0 flex-1 mr-4">
          <p className="text-[15px] font-semibold text-white">
            Mode Furtif
            <span className="ml-1.5 text-[13px] font-medium text-[#BF5AF2]">Stealth</span>
          </p>
          <p className="mt-1 text-[13px] leading-snug text-[#8E8E93]">
            Masque ta localisation dans le feed social — aucune ville ni zone affichée.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Activer le mode furtif"
          disabled={disabled}
          onClick={() => onChange(!enabled)}
          className={`relative h-8 w-[52px] shrink-0 overflow-hidden rounded-full transition-colors disabled:opacity-40 ${
            enabled ? 'bg-[#BF5AF2]' : 'bg-[#3A3A3C]'
          }`}
        >
          <span
            className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </button>
      </div>
    </section>
  )
}
