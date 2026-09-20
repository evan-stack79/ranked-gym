import { LEGAL_PRIVACY_PATH, LEGAL_TERMS_PATH, type LegalDocumentKind } from './legalRoutes'

const TERMS_PARAGRAPHS = [
  'Ranked Gym est une application de suivi sportif en bêta privée. L’accès est réservé aux personnes invitées.',
  'En utilisant l’app, tu t’engages à fournir des informations exactes, à protéger tes identifiants, et à ne pas détourner le service.',
  'Les contenus, marques et visuels Ranked Gym restent notre propriété. Tu conserves tes données d’entraînement ; tu nous accordes le droit de les héberger pour faire fonctionner le service.',
  'Nous pouvons suspendre un compte en cas d’abus, d’accès non autorisé ou de non-respect de ces conditions.',
  'Pour toute question : utilise l’écran de connexion de l’application (bêta sur invitation).',
]

const PRIVACY_PARAGRAPHS = [
  'Nous collectons l’email, le profil sportif et les données que tu saisis (entraînement, nutrition, récupération) pour faire fonctionner Ranked Gym.',
  'La session est restaurée localement sur ton appareil. Les sauvegardes cloud, si activées, restent liées à ton compte.',
  'Nous ne vendons pas tes données. Les sous-traitants techniques n’y accèdent que pour opérer l’infrastructure.',
  'Tu peux demander l’accès, la correction ou la suppression de tes données depuis le compte, une fois connecté.',
  'Cette politique s’applique à la bêta privée Ranked Gym. Elle pourra être précisée avant une ouverture plus large.',
]

export function LegalDocumentScreen({ kind }: { kind: LegalDocumentKind }) {
  const isTerms = kind === 'terms'
  const title = isTerms ? 'Conditions d’utilisation' : 'Politique de confidentialité'
  const paragraphs = isTerms ? TERMS_PARAGRAPHS : PRIVACY_PARAGRAPHS
  const otherHref = isTerms ? LEGAL_PRIVACY_PATH : LEGAL_TERMS_PATH
  const otherLabel = isTerms ? 'Politique de confidentialité' : 'Conditions d’utilisation'

  return (
    <div
      className="flex min-h-[100dvh] flex-col bg-[#070708] font-sans text-white"
      data-legal-document={kind}
      style={{
        paddingTop: 'max(1.25rem, var(--app-safe-area-top, env(safe-area-inset-top, 0px)))',
        paddingBottom: 'max(1.25rem, var(--app-safe-area-bottom, env(safe-area-inset-bottom, 0px)))',
        paddingLeft: 'max(1.25rem, var(--app-safe-area-left, env(safe-area-inset-left, 0px)))',
        paddingRight: 'max(1.25rem, var(--app-safe-area-right, env(safe-area-inset-right, 0px)))',
      }}
    >
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col">
        <a
          href="/"
          className="inline-flex min-h-11 items-center text-[15px] font-medium text-[#AEAEB2] underline-offset-2 hover:text-white hover:underline"
        >
          Retour
        </a>
        <h1 className="mt-6 text-[28px] font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] text-[#8E8E93]">Ranked Gym · Bêta privée</p>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#EBEBF5]">
          {paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        <p className="mt-8 text-[13px] text-[#8E8E93]">
          Voir aussi{' '}
          <a className="text-[#EBEBF5] underline underline-offset-2" href={otherHref}>
            {otherLabel}
          </a>
          .
        </p>
      </div>
    </div>
  )
}
