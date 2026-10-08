import { MapPin } from 'lucide-react'
import {
  LOCATION_CONSENT_BODY,
  LOCATION_CONSENT_NO,
  LOCATION_CONSENT_RETENTION,
  LOCATION_CONSENT_SETTINGS,
  LOCATION_CONSENT_TITLE,
  LOCATION_CONSENT_YES,
  MOCKUP_BADGE,
} from '../../lib/gymLeaderboard/texts'

/**
 * Pre-iOS location consent — equal-size buttons, no form animations.
 * Shown the first time the user taps « Je suis à la salle ».
 */
export function GymLocationConsentSheet({
  open,
  onAccept,
  onDecline,
  showMockupBadge = false,
}: {
  open: boolean
  onAccept: () => void
  onDecline: () => void
  showMockupBadge?: boolean
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gym-location-consent-title"
      data-classement-location-consent
    >
      <div className="rounded-t-3xl border-t border-white/10 bg-[#1C1C1E] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#2C2C2E] text-white"
            aria-hidden="true"
          >
            <MapPin className="h-5 w-5" />
          </span>
          {showMockupBadge ? (
            <span className="rounded-full bg-[#3A3A3C] px-2.5 py-1 text-[11px] font-medium text-[#AEAEB2]">
              {MOCKUP_BADGE}
            </span>
          ) : null}
        </div>
        <h2
          id="gym-location-consent-title"
          className="text-[22px] font-bold leading-tight tracking-tight text-white"
        >
          {LOCATION_CONSENT_TITLE}
        </h2>
        <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#AEAEB2]">
          <p>{LOCATION_CONSENT_BODY}</p>
          <p>{LOCATION_CONSENT_RETENTION}</p>
          <p>{LOCATION_CONSENT_SETTINGS}</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onDecline}
            className="min-h-12 rounded-xl border border-white/15 bg-transparent px-3 text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            {LOCATION_CONSENT_NO}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="min-h-12 rounded-xl border border-white/15 bg-transparent px-3 text-[15px] font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            {LOCATION_CONSENT_YES}
          </button>
        </div>
      </div>
    </div>
  )
}
