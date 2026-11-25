import { ChevronLeft } from 'lucide-react'
import { BrandMark } from '../../brand/BrandMark'
import { CRENEAU_V9_BG } from '../../../creneau/v9Display'

export type CreneauV9ScreenProps = {
  /** Hero photo URL (already includes red trail). */
  heroSrc: string
  /** Small uppercase title above the giant line (e.g. PARS À). */
  eyebrow: string
  /** Giant info — time or word. */
  giant: string
  line1?: string | null
  line2?: string | null
  primaryLabel: string
  onPrimary: () => void
  secondaryLabel?: string | null
  onSecondary?: () => void
  onBack: () => void
  /** data-creneau-v9-state for tests / capture */
  stateId: string
}

/**
 * Shared v9 chrome: full-bleed hero, fades to #1d1f20, giant info, ≤2 lines,
 * white full-width button + secondary link. Same element heights every state.
 */
export function CreneauV9Screen({
  heroSrc,
  eyebrow,
  giant,
  line1,
  line2,
  primaryLabel,
  onPrimary,
  secondaryLabel,
  onSecondary,
  onBack,
  stateId,
}: CreneauV9ScreenProps) {
  return (
    <div
      className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden rounded-none"
      style={{ background: CRENEAU_V9_BG }}
      data-creneau-v9
      data-creneau-v9-state={stateId}
    >
      {/* Full-bleed photo */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={heroSrc}
          alt=""
          className="h-full w-full object-cover object-center"
          draggable={false}
        />
        {/* Fade top under status / title bar only */}
        <div
          className="absolute inset-x-0 top-0 h-[12%]"
          style={{
            background: `linear-gradient(180deg, ${CRENEAU_V9_BG} 0%, ${CRENEAU_V9_BG}cc 35%, transparent 100%)`,
          }}
          aria-hidden
        />
        {/* Fade bottom under copy */}
        <div
          className="absolute inset-x-0 bottom-0 h-[42%]"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${CRENEAU_V9_BG}99 35%, ${CRENEAU_V9_BG} 78%)`,
          }}
          aria-hidden
        />
      </div>

      {/* Top bar */}
      <header className="relative z-10 flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onBack}
          className="ios-press flex min-h-11 min-w-11 items-center justify-center text-white"
          aria-label="Retour"
          data-creneau-v9-back
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <h1
          className="text-[13px] font-bold uppercase tracking-[0.14em] text-white"
          style={{ textShadow: '0 1px 8px rgba(0,0,0,0.55)' }}
        >
          Mon créneau
        </h1>
        <div className="flex min-h-11 min-w-11 items-center justify-end">
          <BrandMark variant="compact" showWordmark={false} className="!gap-0 scale-90" />
        </div>
      </header>

      {/* Content anchored low — same heights every state */}
      <div className="relative z-10 mt-auto flex flex-col px-5 pb-[calc(var(--app-bottom-nav,72px)+env(safe-area-inset-bottom,0px)+16px)] pt-6">
        <p
          className="min-h-[1.25rem] text-[15px] font-bold uppercase tracking-[0.04em] text-white"
          style={{ textShadow: '0 1px 10px rgba(0,0,0,0.55)' }}
          data-creneau-v9-eyebrow
        >
          {eyebrow}
        </p>
        <p
          className="mt-1 min-h-[3.5rem] text-[clamp(3.1rem,14vw,4.5rem)] font-black uppercase leading-[0.92] tracking-[-0.045em] text-white"
          style={{
            fontStretch: 'condensed',
            textShadow: '0 2px 14px rgba(0,0,0,0.5)',
          }}
          data-creneau-v9-giant
        >
          {giant}
        </p>

        <div className="mt-3 min-h-[2.75rem] space-y-1">
          {line1 ? (
            <p
              className="text-left text-[14px] leading-snug text-[#E8E8ED]"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.45)' }}
              data-creneau-v9-line1
            >
              {line1}
            </p>
          ) : (
            <p className="text-[14px] leading-snug opacity-0" aria-hidden>
              —
            </p>
          )}
          {line2 ? (
            <p
              className="text-left text-[14px] leading-snug text-[#E8E8ED]"
              style={{ textShadow: '0 1px 8px rgba(0,0,0,0.45)' }}
              data-creneau-v9-line2
            >
              {line2}
            </p>
          ) : (
            <p className="text-[14px] leading-snug opacity-0" aria-hidden>
              —
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onPrimary}
          className="ios-press mt-8 w-full rounded-2xl bg-white py-[17px] text-center text-[16px] font-bold uppercase tracking-[0.06em] text-black"
          data-creneau-v9-primary
        >
          {primaryLabel}
        </button>

        <div className="mt-3 flex min-h-[1.25rem] items-center justify-center">
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              onClick={onSecondary}
              className="text-[12px] font-semibold uppercase tracking-[0.12em] text-white/90"
              data-creneau-v9-secondary
            >
              {secondaryLabel}
            </button>
          ) : (
            <span className="opacity-0" aria-hidden>
              —
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
