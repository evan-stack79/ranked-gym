import {
  CONTACT_UNAVAILABLE_MESSAGE,
  SUPPORT_EMAIL,
  WRITE_TO_US_LABEL,
  buildSupportMailtoHref,
  isValidSupportEmail,
} from '../../config/contact'

interface ContactUsBlockProps {
  /** Message au-dessus du bouton (ex. TCA locked / âge). */
  message: string
  testIdPrefix?: string
}

/**
 * Message + bouton « Nous écrire » + adresse sélectionnable.
 * Si SUPPORT_EMAIL vide : bouton visible, message « Adresse… », pas de mailto.
 */
export function ContactUsBlock({ message, testIdPrefix = 'contact-us' }: ContactUsBlockProps) {
  const mailto = buildSupportMailtoHref()
  const emailReady = isValidSupportEmail(SUPPORT_EMAIL)

  const onWrite = () => {
    if (!mailto) return
    window.location.href = mailto
  }

  return (
    <div className="space-y-1.5" data-testid={testIdPrefix}>
      <p
        className="px-1 text-[12px] leading-snug text-[#ACB4BA]"
        data-testid={`${testIdPrefix}-message`}
      >
        {message}
      </p>
      <div className="flex flex-wrap items-center gap-2 px-1">
        <button
          type="button"
          onClick={onWrite}
          className="ios-press text-[13px] font-semibold text-[#64D2FF] underline"
          data-testid={`${testIdPrefix}-write-btn`}
          aria-disabled={!emailReady}
        >
          {WRITE_TO_US_LABEL}
        </button>
        <span
          className="select-text text-[12px] text-[#ACB4BA]"
          style={{ userSelect: 'text' }}
          data-testid={`${testIdPrefix}-address`}
        >
          {emailReady ? SUPPORT_EMAIL.trim() : CONTACT_UNAVAILABLE_MESSAGE}
        </span>
      </div>
    </div>
  )
}
