/**
 * Textes santé / sécurité — verbatim validés (DEV-RG-03 lot 1).
 * Ne pas reformuler. Re-vérifier les ressources TCA avant publication :
 * https://www.reseautca-idf.org/actions/ligne-decoute-anorexie-boulimie-info-ecoute
 */
export const TCA_RESOURCES_LAST_VERIFIED = '2026-10-02'

export const M_CAL_3 = "Cette valeur est trop basse pour être proposée dans l'app. Si tu souhaites changer ton alimentation de façon importante, un professionnel de santé peut t'accompagner."

/** Phrase seule pour la zone 1200–1500 kcal/j (extrait de M-CAL-3). */
export const M_CAL_3_SOFT = "Si tu souhaites changer ton alimentation de façon importante, un professionnel de santé peut t'accompagner."

export const M_INFO_1 = "Repère indicatif. Il ne remplace pas l'avis d'un médecin ou d'un diététicien."

export const Q1_TOUS_AGES = "Cette valeur est une estimation. Elle peut s'écarter de ta dépense réelle. Observe ton poids et ton énergie dans la durée plutôt que de te fier au chiffre près."

export const Q1_18_ANS = 'À 18 ans, cette estimation est moins bien établie. Elle sert seulement de repère. Pour un objectif de perte de poids, parles-en à un professionnel de santé.'

export const Q1_PLUS_DE_78_ANS = "Cette formule n'a pas été validée à ton âge. Pour tes besoins alimentaires, un médecin ou un diététicien est le mieux placé pour te conseiller."

export const Q3_VITESSE = "Une perte lente est plus facile à tenir. Les repères officiels parlent d'une perte progressive, de l'ordre de quelques centaines de grammes par semaine. Cette limite n'est pas la même pour tout le monde : un professionnel de santé peut t'aider à la fixer."

export const SEC_NUT_05_ORIGINE = "Cette vitesse maximale vient de la préparation de compétition ; elle n'est pas validée pour tout le monde."

export const Q4_IMC = "D'après ta taille et ton poids, une perte de poids n'est pas conseillée. Si tu as des questions sur ton alimentation ou ton poids, un professionnel de santé peut t'écouter, sans jugement."

export const Q6B_GROSSESSE_ALLAITEMENT = "Pendant la grossesse et l'allaitement, les besoins changent et dépendent de chaque personne. Il n'est pas nécessaire de manger pour deux. Ranked Gym ne propose pas d'objectif pour cette période : ta sage-femme ou ton médecin est la meilleure personne pour t'accompagner."

export const M_CAL_1 = "Tu n'as pas besoin d'objectif chiffré. Si tu en veux un, voici une estimation de départ. Elle peut ne pas correspondre à ton corps. Tu restes libre de l'ajuster ou de l'ignorer."

export const M_CAL_2 = "Estimation à ajuster selon l'évolution réelle. Elle ne vaut pas pour tout le monde."

export const M_MIN_1 = 'Certaines fonctions de nutrition et le classement ne sont pas proposés avant 18 ans. Si tu as des questions sur ton alimentation, parles-en à un adulte de confiance ou à un professionnel de santé.'

export const Q6A_MINEURS = "À ton âge, le corps est en pleine croissance et les besoins varient beaucoup. Ranked Gym ne donne pas d'objectif alimentaire. Pour toute question sur ton alimentation, parle à un médecin, à une infirmière scolaire ou à un diététicien."

export const Q12_PROFIL_PRIVE = 'Ton profil est privé. Les classements sont réservés aux adultes. Ranked Gym ne partage jamais ton poids, tes photos de corps ni ton alimentation.'

export const Q8_ECRAN_ORIENTATION = "Besoin d'en parler ? Tu n'es pas seul(e). Un professionnel de santé peut t'écouter, sans jugement. Ton médecin traitant peut être un bon premier contact.\n• Anorexie Boulimie Info Écoute : 09 69 325 900 — écoute anonyme, lundi, mardi, jeudi et vendredi de 16 h à 18 h (hors jours fériés).\n• Fil Santé Jeunes (12-25 ans) : 0 800 235 236 — gratuit et anonyme, tous les jours de 9 h à 23 h.\n• Si tu es en détresse, tu peux appeler le 3114, 24 h/24 et gratuitement. En cas d'urgence médicale : le 15.\n• Trouver une structure près de chez toi : annuaire de la FFAB."

export const Q10_ENERGIE = "Bien manger et bien récupérer aident à progresser et à tenir dans la durée. Les besoins varient beaucoup d'une personne à l'autre : il n'existe pas de chiffre valable pour tout le monde. Si tu ressens une fatigue qui dure, un sommeil perturbé, des douleurs inhabituelles, des changements dans ton cycle, ou si tu as du mal à te reposer sans culpabiliser, parles-en à un professionnel de santé."

export const Q7_INTRO = "Ces questions sont facultatives. Elles servent à adapter ce que l'app te propose. Ce n'est pas un diagnostic et ça ne remplace pas l'avis d'un professionnel de santé. Tu peux répondre « Je préfère ne pas répondre »."

export const M_TCA_1 = "Merci de nous l'avoir dit. On retire de ton app les objectifs chiffrés et le classement. Tu peux les remettre quand tu veux, dans Réglages. Parler à un professionnel peut aider : voici des ressources."

export const Q8_SCREEN_TITLE = "Besoin d'en parler ?"

/** Numéros affichés (espaces conservés) + liens tel: */
export const TCA_PHONE_DISPLAY = {
  anorexieBoulimie: '09 69 325 900',
  filSanteJeunes: '0 800 235 236',
  detresse: '3114',
  urgence: '15',
  abaPermanence: '06 34 32 93 81',
} as const

export const TCA_PHONE_TEL = {
  anorexieBoulimie: 'tel:0969325900',
  filSanteJeunes: 'tel:0800235236',
  detresse: 'tel:3114',
  urgence: 'tel:15',
  abaPermanence: 'tel:0634329381',
} as const

export const TCA_RESOURCE_LINKS = {
  ffabAnnuaire: 'https://www.ffab.fr/trouver-de-l-aide/annuaire-2021',
  maisonsAdolescents: 'https://anmda.fr/fr/les-maisons-des-adolescents',
  hasAnorexie:
    'https://www.has-sante.fr/jcms/c_985715/fr/anorexie-mentale-prise-en-charge',
  hasBoulimie:
    'https://www.has-sante.fr/jcms/c_2581436/fr/boulimie-et-hyperphagie-boulimique-reperage-et-elements-generaux-de-prise-en-charge',
  aba: 'https://www.anorexiques-boulimiques-anonymes.org/',
} as const

export const TCA_RESOURCE_LABELS = {
  ffabAnnuaire: 'FFAB — annuaire national des structures TCA',
  maisonsAdolescents: 'Maisons des Adolescents',
  hasAnorexie: 'HAS — anorexie mentale (recommandations pour professionnels)',
  hasBoulimie:
    'HAS — boulimie et hyperphagie boulimique (recommandations pour professionnels)',
  aba: 'Anorexiques Boulimiques Anonymes (pairs, ressource secondaire)',
} as const

