import { ChevronLeft } from 'lucide-react'
import {
  MANUAL_ADD_CITY_LABEL,
  MANUAL_ADD_NAME_LABEL,
  MANUAL_ADD_TITLE,
  MANUAL_FALLBACK_HINT,
} from '../../lib/gymLeaderboard/texts'

export function GymManualAddScreen({
  name,
  city,
  onNameChange,
  onCityChange,
  onSubmit,
  onBack,
  busy = false,
}: {
  name: string
  city: string
  onNameChange: (v: string) => void
  onCityChange: (v: string) => void
  onSubmit: () => void
  onBack?: () => void
  busy?: boolean
}) {
  const canSubmit = name.trim().length >= 2 && city.trim().length >= 2 && !busy

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[#0C0C0E] text-white"
      data-classement-manual-add
    >
      <header
        className="flex items-center gap-2 px-4 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="ios-press flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
            aria-label="Retour"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <h1 className="text-[22px] font-bold tracking-tight">{MANUAL_ADD_TITLE}</h1>
      </header>

      <div className="flex-1 px-4 pb-6">
        <p className="mb-5 text-[14px] leading-relaxed text-[#8E8E93]">{MANUAL_FALLBACK_HINT}</p>
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
            {MANUAL_ADD_NAME_LABEL}
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={24}
            className="w-full rounded-2xl border border-white/10 bg-[#141416] px-4 py-3.5 text-[16px] text-white outline-none focus:border-[#FF2B2B]/40"
          />
        </label>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-[12px] font-semibold text-[#8E8E93]">
            {MANUAL_ADD_CITY_LABEL}
          </span>
          <input
            type="text"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            maxLength={64}
            className="w-full rounded-2xl border border-white/10 bg-[#141416] px-4 py-3.5 text-[16px] text-white outline-none focus:border-[#FF2B2B]/40"
          />
        </label>
        <p className="mt-3 text-[12px] leading-relaxed text-[#8E8E93]">
          Le nom est vérifié comme un pseudo et peut être signalé. Pour placer la salle, tu
          valideras ta présence une fois sur place.
        </p>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={onSubmit}
          className="ios-press mt-6 flex min-h-12 w-full items-center justify-center rounded-2xl bg-[#FF2B2B] text-[16px] font-semibold text-white disabled:opacity-40"
        >
          Continuer
        </button>
      </div>
    </div>
  )
}
