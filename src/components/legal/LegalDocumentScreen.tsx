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
  'Lorsque tu cherches un aliment, les photos produit sont chargées depuis Open Food Facts : ce service tiers peut voir l’adresse IP de ton appareil.',
  'Nous ne vendons pas tes données. Les sous-traitants techniques n’y accèdent que pour opérer l’infrastructure.',
  'Tu peux demander l’accès, la correction ou la suppression de tes données depuis le compte, une fois connecté.',
  'Cette politique s’applique à la bêta privée Ranked Gym. Elle pourra être précisée avant une ouverture plus large.',
]

/** Rubrique Juriste — mots du cadrage « Durées de conservation ». */
export const PRIVACY_RETENTION_TITLE = 'Durées de conservation'

export const PRIVACY_RETENTION_INTRO =
  'Quand quelqu’un supprime son compte, on efface tout. On ne garde une donnée que s’il y a une vraie raison, et seulement le temps qu’il faut, avec le minimum d’informations. Archive à part, accès limité, sans profil ni données de santé.'

export const PRIVACY_RETENTION_BULLETS = [
  'Achats (identifiant de transaction du store, produit, dates, montant, store) : 5 ans après la fin de l’abonnement, puis effacer. Pour prouver une vente, répondre à une réclamation ou à un litige, et faire la compta. Remplacer l’identifiant utilisateur par un identifiant sans lien avec le compte. Supprimer tout le reste.',
  'Codes partenaires déjà donnés : 1 an après l’utilisation du code, ou la durée du contrat partenaire si elle est plus courte. Garder le code, la date, le partenaire et le nombre de points. Pas d’identité.',
  'Preuve que l’âge a été vérifié : 1 an, à valider avec un DPO ou un avocat. Garder seulement la date et le résultat (« 15 ans et plus : oui »). Aucune donnée de santé.',
  'Preuve de sécurité en cas de piratage de compte (prise de compte Google) : 6 mois. Pas de mot de passe ni de jeton.',
] as const

export const PRIVACY_RETENTION_FOOTER =
  'Le reste (eau, classement, récompenses non données, abonnement côté app, compte, santé et suivi, planning et photo de gourde sur le téléphone) est effacé à la suppression. « Anonymiser » veut dire qu’on ne peut plus jamais retrouver la personne.'

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
          className="inline-flex min-h-11 items-center text-[15px] font-medium text-[#ACB4BA] underline-offset-2 hover:text-white hover:underline"
        >
          Retour
        </a>
        <h1 className="mt-6 text-[28px] font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-[13px] text-[#ACB4BA]">Ranked Gym · Bêta privée</p>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-[#EBEBF5]">
          {paragraphs.map((text) => (
            <p key={text}>{text}</p>
          ))}
        </div>
        {!isTerms ? (
          <section className="mt-8 space-y-3" data-legal-retention>
            <h2 className="text-[20px] font-semibold tracking-tight text-white">
              {PRIVACY_RETENTION_TITLE}
            </h2>
            <p className="text-[15px] leading-relaxed text-[#EBEBF5]">{PRIVACY_RETENTION_INTRO}</p>
            <ul className="list-disc space-y-3 pl-5 text-[15px] leading-relaxed text-[#EBEBF5]">
              {PRIVACY_RETENTION_BULLETS.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <p className="text-[15px] leading-relaxed text-[#EBEBF5]">{PRIVACY_RETENTION_FOOTER}</p>
          </section>
        ) : null}
        <p className="mt-8 text-[13px] text-[#ACB4BA]">
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
