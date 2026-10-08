import { ChevronLeft, MapPin } from 'lucide-react'
import {
  CLASSEMENT_TITLE,
  JOIN_LATER,
  JOIN_WITH_PSEUDO,
  MOCKUP_BADGE,
  PSEUDO_LABEL,
  PSEUDO_PLACEHOLDER,
  PSEUDO_PRIVACY,
  RULES_BODY,
  RULES_CARD_TITLE,
  RULES_FOOTER,
} from '../../lib/gymLeaderboard/texts'

export function GymRulesJoinScreen({
  gymLabel,
  pseudo,
  onPseudoChange,
  onJoin,
  onLater,
  onBack,
  joinDisabled = false,
  showMockupBadge = false,
}: {
  gymLabel: string
  pseudo: string
  onPseudoChange: (value: string) => void
  onJoin: () => void
  onLater: () => void
  onBack?: () => void
  joinDisabled?: boolean
  showMockupBadge?: boolean
}) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-[#0C0C0E] text-white"
      data-classement-rules
    >
      <header
        className="shrink-0 px-4 pb-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
      >
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="ios-press flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-10" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[22px] font-bold tracking-tight">{CLASSEMENT_TITLE}</h1>
              {showMockupBadge ? (
                <span className="rounded-full bg-[#3A3A3C] px-2 py-0.5 text-[11px] font-medium text-[#AEAEB2]">
                  {MOCKUP_BADGE}
                </span>
              ) : null}
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-[13px] text-[#AEAEB2]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" aria-hidden="true" />
              <span className="truncate">{gymLabel}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <section className="rounded-2xl border border-white/10 bg-[#1C1C1E] p-4">
          <h2 className="text-[11px] font-semibold tracking-wide text-[#8E8E93]">
            {RULES_CARD_TITLE}
          </h2>
          <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#E5E5EA]">
            {RULES_BODY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <div className="mt-3 space-y-1 px-1 text-[13px] text-[#8E8E93]">
          {RULES_FOOTER.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>

        <label className="mt-6 block">
          <span className="mb-2 block text-[11px] font-semibold tracking-wide text-[#8E8E93]">
            {PSEUDO_LABEL}
          </span>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => onPseudoChange(e.target.value)}
            placeholder={PSEUDO_PLACEHOLDER}
            autoComplete="nickname"
            maxLength={24}
            className="w-full rounded-2xl border border-white/10 bg-[#141416] px-4 py-3.5 text-[16px] text-white outline-none placeholder:text-[#636366] focus:border-[#FF2B2B]/40"
          />
        </label>
        <p className="mt-2 px-1 text-[12px] leading-relaxed text-[#8E8E93]">{PSEUDO_PRIVACY}</p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onJoin}
            disabled={joinDisabled || pseudo.trim().length < 2}
            className="ios-press flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-[#2C2C2E] text-[16px] font-semibold text-white disabled:opacity-40"
          >
            {JOIN_WITH_PSEUDO}
          </button>
          <button
            type="button"
            onClick={onLater}
            className="ios-press flex min-h-12 w-full items-center justify-center rounded-2xl border border-white/10 bg-[#2C2C2E] text-[16px] font-semibold text-white"
          >
            {JOIN_LATER}
          </button>
        </div>
      </div>
    </div>
  )
}
