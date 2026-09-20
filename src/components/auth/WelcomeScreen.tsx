import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '../legal/legalRoutes'
import {
  WELCOME_BETA,
  WELCOME_BRAND_GYM,
  WELCOME_BRAND_RANKED,
  WELCOME_CTA,
  WELCOME_HERO_HEIGHT,
  WELCOME_HERO_PNG,
  WELCOME_HERO_WEBP,
  WELCOME_HERO_WIDTH,
  WELCOME_LEGAL_AFTER,
  WELCOME_LEGAL_AND,
  WELCOME_LEGAL_BEFORE,
  WELCOME_LEGAL_PRIVACY,
  WELCOME_LEGAL_TERMS,
  WELCOME_SUBTITLE_LINE_1,
  WELCOME_SUBTITLE_LINE_2,
  WELCOME_TITLE_LINE_1,
  WELCOME_TITLE_LINE_2,
} from './welcomeCopy'

interface WelcomeScreenProps {
  onConnect: () => void
}

export function WelcomeScreen({ onConnect }: WelcomeScreenProps) {
  return (
    <div
      className="welcome-screen relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#070708] font-sans"
      data-welcome-screen="1"
    >
      <picture className="welcome-screen__picture">
        <source srcSet={WELCOME_HERO_WEBP} type="image/webp" />
        <img
          src={WELCOME_HERO_PNG}
          alt=""
          width={WELCOME_HERO_WIDTH}
          height={WELCOME_HERO_HEIGHT}
          decoding="async"
          draggable={false}
          className="welcome-screen__hero pointer-events-none select-none"
          data-welcome-hero="1"
        />
      </picture>

      <div className="welcome-screen__body relative z-[1] mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-end">
        <h1 className="welcome-screen__brand text-center font-semibold tracking-tight text-[#F2F2F7]">
          {WELCOME_BRAND_RANKED}{' '}
          <span className="text-[#FF2B2B]">{WELCOME_BRAND_GYM}</span>
        </h1>
        <p className="welcome-screen__title mx-auto max-w-[20rem] text-center font-bold tracking-tight text-white">
          <span className="block">{WELCOME_TITLE_LINE_1} </span>
          <span className="block">{WELCOME_TITLE_LINE_2}</span>
        </p>
        <p className="welcome-screen__subtitle mx-auto max-w-[22rem] text-center font-medium text-[#AEAEB2]">
          <span className="block">{WELCOME_SUBTITLE_LINE_1} </span>
          <span className="block">{WELCOME_SUBTITLE_LINE_2}</span>
        </p>

        <button
          type="button"
          onClick={onConnect}
          data-welcome-cta="1"
          className="welcome-screen__cta ios-press w-full min-h-12 rounded-lg bg-[#FF2B2B] text-[16px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {WELCOME_CTA}
        </button>
        <p className="welcome-screen__beta mt-3 text-center text-[13px] font-medium text-[#8E8E93]">
          {WELCOME_BETA}
        </p>
        <p className="welcome-screen__legal mx-auto max-w-[24rem] text-center text-[11px] leading-relaxed text-[#8E8E93]">
          {WELCOME_LEGAL_BEFORE}
          <a
            className="whitespace-nowrap font-medium text-[#EBEBF5] underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            href={LEGAL_TERMS_PATH}
          >
            {WELCOME_LEGAL_TERMS}
          </a>
          {WELCOME_LEGAL_AND}
          <a
            className="whitespace-nowrap font-medium text-[#EBEBF5] underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            href={LEGAL_PRIVACY_PATH}
          >
            {WELCOME_LEGAL_PRIVACY}
          </a>
          {WELCOME_LEGAL_AFTER}
        </p>
      </div>
    </div>
  )
}
