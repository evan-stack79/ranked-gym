import { useState } from 'react'
import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH } from '../legal/legalRoutes'
import {
  WELCOME_BETA,
  WELCOME_BRAND_GYM,
  WELCOME_BRAND_RANKED,
  WELCOME_CTA,
  WELCOME_FABRIC_AVIF,
  WELCOME_FABRIC_WEBP,
  WELCOME_LEGAL_AFTER,
  WELCOME_LEGAL_AND,
  WELCOME_LEGAL_BEFORE,
  WELCOME_LEGAL_PRIVACY,
  WELCOME_LEGAL_TERMS,
  WELCOME_LOGO_ALT,
  WELCOME_LOGO_PNG,
  WELCOME_LOGO_WEBP,
  WELCOME_SUBTITLE,
  WELCOME_TITLE,
} from './welcomeCopy'

interface WelcomeScreenProps {
  onConnect: () => void
}

export function WelcomeScreen({ onConnect }: WelcomeScreenProps) {
  const [logoSrc, setLogoSrc] = useState(WELCOME_LOGO_WEBP)

  return (
    <div
      className="welcome-screen relative flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[#070708] font-sans"
      data-welcome-screen="1"
    >
      <div
        className="welcome-screen__visual relative w-full shrink-0 overflow-hidden bg-black"
        data-welcome-visual="1"
      >
        <picture>
          <source srcSet={WELCOME_FABRIC_AVIF} type="image/avif" />
          <img
            src={WELCOME_FABRIC_WEBP}
            alt=""
            width={780}
            height={920}
            decoding="async"
            draggable={false}
            className="welcome-screen__texture pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        <div className="welcome-screen__fade pointer-events-none absolute inset-x-0 bottom-0" aria-hidden />
        <img
          src={logoSrc}
          alt={WELCOME_LOGO_ALT}
          width={400}
          height={400}
          decoding="async"
          draggable={false}
          className="welcome-screen__logo relative z-[1] mx-auto select-none object-contain"
          onError={() => {
            if (logoSrc !== WELCOME_LOGO_PNG) setLogoSrc(WELCOME_LOGO_PNG)
          }}
        />
      </div>

      <div className="welcome-screen__body relative z-[1] mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col">
        <p className="welcome-screen__brand text-center font-semibold tracking-tight text-[#F2F2F7]">
          {WELCOME_BRAND_RANKED}{' '}
          <span className="text-[#FF2B2B]">{WELCOME_BRAND_GYM}</span>
        </p>
        <h1 className="welcome-screen__title mx-auto max-w-[20rem] text-center font-bold tracking-tight text-white">
          {WELCOME_TITLE}
        </h1>
        <p className="welcome-screen__subtitle mx-auto max-w-[22rem] text-center font-medium text-[#AEAEB2]">
          {WELCOME_SUBTITLE}
        </p>

        <button
          type="button"
          onClick={onConnect}
          data-welcome-cta="1"
          className="welcome-screen__cta ios-press mt-auto w-full min-h-12 rounded-2xl bg-[#FF2B2B] text-[16px] font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-white/80"
        >
          {WELCOME_CTA}
        </button>
        <p className="welcome-screen__beta mt-3 text-center text-[13px] font-medium text-[#8E8E93]">
          {WELCOME_BETA}
        </p>
        <p className="welcome-screen__legal mx-auto mt-auto max-w-[24rem] text-center text-[11px] leading-relaxed text-[#8E8E93]">
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
