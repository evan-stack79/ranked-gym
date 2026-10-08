import { useMemo, useState } from 'react'
import { ChevronLeft, MapPin } from 'lucide-react'
import {
  CLASSEMENT_TITLE,
  CTA_AT_GYM,
  GOOGLE_MAPS_ATTRIBUTION,
  LEAVE_CLASSEMENT,
  MIN_MEMBERS_HINT,
  MOCKUP_BADGE,
  POINTS_FOOTER,
  TAB_MONTH,
  TAB_WEEK,
} from '../../lib/gymLeaderboard/texts'
import {
  buildPodiumSlots,
  GymLeaderboardPodium,
} from './GymLeaderboardPodium'
import { GymLeaderboardList, type LeaderboardRow } from './GymLeaderboardList'
import { GymLocationConsentSheet } from './GymLocationConsentSheet'

export type ClassementPeriod = 'week' | 'month'

export function GymLeaderboardScreen({
  gymLabel,
  showGoogleAttribution = false,
  period,
  onPeriodChange,
  rows,
  rankingVisible = true,
  memberCount = 0,
  locationConsentKnown = false,
  locationConsent = false,
  onRequestAtGym,
  onConsentAccept,
  onConsentDecline,
  onLeave,
  onBack,
  showMockupBadge = false,
  consentOpen: consentOpenProp,
}: {
  gymLabel: string
  showGoogleAttribution?: boolean
  period: ClassementPeriod
  onPeriodChange: (p: ClassementPeriod) => void
  rows: LeaderboardRow[]
  rankingVisible?: boolean
  memberCount?: number
  locationConsentKnown?: boolean
  locationConsent?: boolean
  onRequestAtGym: () => void
  onConsentAccept: () => void
  onConsentDecline: () => void
  onLeave?: () => void
  onBack?: () => void
  showMockupBadge?: boolean
  /** Fixture / controlled consent sheet */
  consentOpen?: boolean
}) {
  const [localConsentOpen, setLocalConsentOpen] = useState(false)
  const consentOpen = consentOpenProp ?? localConsentOpen

  const podiumSlots = useMemo(
    () => (period === 'month' ? buildPodiumSlots(rows) : []),
    [period, rows],
  )

  const handleAtGym = () => {
    if (!locationConsentKnown) {
      if (consentOpenProp === undefined) setLocalConsentOpen(true)
      onRequestAtGym()
      return
    }
    if (!locationConsent) {
      onRequestAtGym()
      return
    }
    onRequestAtGym()
  }

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col bg-[#0C0C0E] text-white"
      data-classement-screen
      data-classement-period={period}
    >
      <header
        className="shrink-0 px-4 pb-2"
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
          <div className="min-w-0 flex-1 text-center">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight">{CLASSEMENT_TITLE}</h1>
              {showMockupBadge ? (
                <span className="rounded-full bg-[#3A3A3C] px-2 py-0.5 text-[10px] font-medium text-[#AEAEB2]">
                  {MOCKUP_BADGE}
                </span>
              ) : null}
            </div>
          </div>
          <span className="w-10" />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 px-1">
          <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-[#AEAEB2]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#8E8E93]" aria-hidden="true" />
            <span className="truncate">{gymLabel}</span>
          </p>
          {showGoogleAttribution ? (
            <span className="shrink-0 text-[10px] text-[#636366]">{GOOGLE_MAPS_ATTRIBUTION}</span>
          ) : null}
        </div>

        <div
          className="mt-4 flex gap-2"
          role="tablist"
          aria-label="Période du classement"
        >
          <button
            type="button"
            role="tab"
            aria-selected={period === 'week'}
            onClick={() => onPeriodChange('week')}
            className={`min-h-10 flex-1 rounded-full text-[14px] font-semibold ${
              period === 'week'
                ? 'bg-[#7A1218] text-white'
                : 'bg-[#1C1C1E] text-[#AEAEB2]'
            }`}
          >
            {TAB_WEEK}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={period === 'month'}
            onClick={() => onPeriodChange('month')}
            className={`min-h-10 flex-1 rounded-full text-[14px] font-semibold ${
              period === 'month'
                ? 'bg-[#7A1218] text-white'
                : 'bg-[#1C1C1E] text-[#AEAEB2]'
            }`}
          >
            {TAB_MONTH}
          </button>
        </div>
      </header>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        style={{
          paddingBottom:
            'calc(7.5rem + env(safe-area-inset-bottom, 0px) + var(--app-bottom-nav, 80px))',
        }}
      >
        {!rankingVisible ? (
          <p className="mt-8 text-center text-[14px] text-[#8E8E93]">
            {MIN_MEMBERS_HINT}
            {memberCount > 0 ? ` (${memberCount}/3)` : null}
          </p>
        ) : (
          <>
            {period === 'month' && podiumSlots.length > 0 ? (
              <GymLeaderboardPodium slots={podiumSlots} />
            ) : null}
            <GymLeaderboardList
              rows={rows}
              skipRanksUpTo={period === 'month' ? 3 : 0}
            />
          </>
        )}

        {onLeave ? (
          <button
            type="button"
            onClick={onLeave}
            className="mt-8 w-full text-center text-[13px] font-medium text-[#8E8E93] underline-offset-2 hover:underline"
          >
            {LEAVE_CLASSEMENT}
          </button>
        ) : null}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 px-4"
        style={{
          paddingBottom:
            'calc(0.75rem + env(safe-area-inset-bottom, 0px) + var(--app-bottom-nav, 80px))',
        }}
      >
        <div className="pointer-events-auto">
          <p className="mb-2 text-center text-[11px] text-[#8E8E93]">{POINTS_FOOTER}</p>
          <button
            type="button"
            onClick={handleAtGym}
            data-classement-at-gym
            className="ios-press flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#FF2B2B] text-[16px] font-semibold text-white"
          >
            <MapPin className="h-4 w-4" aria-hidden="true" />
            {CTA_AT_GYM}
          </button>
        </div>
      </div>

      <GymLocationConsentSheet
        open={consentOpen}
        showMockupBadge={showMockupBadge}
        onAccept={() => {
          if (consentOpenProp === undefined) setLocalConsentOpen(false)
          onConsentAccept()
        }}
        onDecline={() => {
          if (consentOpenProp === undefined) setLocalConsentOpen(false)
          onConsentDecline()
        }}
      />
    </div>
  )
}
