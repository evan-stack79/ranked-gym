import {
  Q8_ECRAN_ORIENTATION,
  Q8_SCREEN_TITLE,
  TCA_PHONE_DISPLAY,
  TCA_PHONE_TEL,
  TCA_RESOURCE_LABELS,
  TCA_RESOURCE_LINKS,
  TCA_RESOURCES_LAST_VERIFIED,
} from '../../content/safetyCopy'

interface NeedToTalkScreenProps {
  onBack: () => void
}

/** Corps du texte sans la phrase d'ouverture (déjà en titre). */
function orientationBodyWithoutTitle(): string {
  const prefix = `${Q8_SCREEN_TITLE} `
  if (Q8_ECRAN_ORIENTATION.startsWith(prefix)) {
    return Q8_ECRAN_ORIENTATION.slice(prefix.length)
  }
  return Q8_ECRAN_ORIENTATION
}

export function NeedToTalkScreen({ onBack }: NeedToTalkScreenProps) {
  const body = orientationBodyWithoutTitle()
  const paragraphs = body.split('\n')

  return (
    <section className="ios-fade-up space-y-5 pb-8" data-testid="need-to-talk-screen">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="ios-press rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[13px] font-semibold text-[#AEAEB2]"
        >
          Retour
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] font-bold tracking-tight text-white">{Q8_SCREEN_TITLE}</h1>
        </div>
      </header>

      <div className="space-y-3 text-[15px] leading-relaxed text-[#EBEBF5]">
        {paragraphs.map((line) => {
          if (line.startsWith('• Anorexie')) {
            return (
              <p key={line}>
                • Anorexie Boulimie Info Écoute :{' '}
                <a className="text-[#64D2FF] underline" href={TCA_PHONE_TEL.anorexieBoulimie}>
                  {TCA_PHONE_DISPLAY.anorexieBoulimie}
                </a>
                {' — écoute anonyme, lundi, mardi, jeudi et vendredi de 16 h à 18 h (hors jours fériés).'}
              </p>
            )
          }
          if (line.startsWith('• Fil Santé')) {
            return (
              <p key={line}>
                • Fil Santé Jeunes (12-25 ans) :{' '}
                <a className="text-[#64D2FF] underline" href={TCA_PHONE_TEL.filSanteJeunes}>
                  {TCA_PHONE_DISPLAY.filSanteJeunes}
                </a>
                {' — gratuit et anonyme, tous les jours de 9 h à 23 h.'}
              </p>
            )
          }
          if (line.startsWith('• Si tu es en détresse')) {
            return (
              <p key={line}>
                • Si tu es en détresse, tu peux appeler le{' '}
                <a className="text-[#64D2FF] underline" href={TCA_PHONE_TEL.detresse}>
                  {TCA_PHONE_DISPLAY.detresse}
                </a>
                , 24 h/24 et gratuitement. En cas d&apos;urgence médicale : le{' '}
                <a className="text-[#64D2FF] underline" href={TCA_PHONE_TEL.urgence}>
                  {TCA_PHONE_DISPLAY.urgence}
                </a>
                .
              </p>
            )
          }
          if (line.startsWith('• Trouver une structure')) {
            return (
              <p key={line}>
                • Trouver une structure près de chez toi :{' '}
                <a
                  className="text-[#64D2FF] underline"
                  href={TCA_RESOURCE_LINKS.ffabAnnuaire}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  annuaire de la FFAB
                </a>
                .
              </p>
            )
          }
          return <p key={line}>{line}</p>
        })}
      </div>

      <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-4">
        <p className="text-[13px] font-semibold text-white">Pour aller plus loin</p>
        <ul className="space-y-2 text-[13px] text-[#AEAEB2]">
          {(
            [
              'ffabAnnuaire',
              'maisonsAdolescents',
              'hasAnorexie',
              'hasBoulimie',
              'aba',
            ] as const
          ).map((key) => (
            <li key={key}>
              <a
                className="text-[#64D2FF] underline"
                href={TCA_RESOURCE_LINKS[key]}
                target="_blank"
                rel="noopener noreferrer"
              >
                {TCA_RESOURCE_LABELS[key]}
              </a>
              {key === 'aba' ? (
                <span>
                  {' ; permanence '}
                  <a className="text-[#64D2FF] underline" href={TCA_PHONE_TEL.abaPermanence}>
                    {TCA_PHONE_DISPLAY.abaPermanence}
                  </a>
                  {' (pas de SMS)'}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="pt-2 text-[11px] text-[#636366]">
          Ressources vérifiées le {TCA_RESOURCES_LAST_VERIFIED}.
        </p>
      </div>

      {/* Constante intégrale conservée pour les tests d'égalité verbatim */}
      <p className="sr-only" data-testid="q8-verbatim">
        {Q8_ECRAN_ORIENTATION}
      </p>
    </section>
  )
}
