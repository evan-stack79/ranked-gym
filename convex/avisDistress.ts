/**
 * Repérage détresse / TCA pour avis bêta — liste Vérificateur §7.4 + décisions QA.
 * Jamais de diagnostic, jamais de blocage d’envoi, rien sur le profil.
 */

/** 0 = aucun · 1 = TCA / mal-être · 2 = idées suicidaires / auto-agression (l’emporte). */
export type DistressLevel = 0 | 1 | 2

/**
 * Normalisation pour comparaison : minuscules, accents retirés,
 * apostrophes typographiques → ', espaces multiples réduits.
 */
export function normalizeForMatch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    // ’ ‘ ‚ ‛ + modifier letter apostrophe ʼ (U+02BC, AV-14)
    .replace(/[\u2018\u2019\u201A\u201B\u02BC`´]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const JE_ME_COUPE_EXCEPTIONS =
  '(?:les ongles|les cheveux|la barbe|la frange)'

const OVERDOSE_VERB =
  '(?:faire|fais|fait|font|faisait|faisais|faisaient|ferai|feras|fera|ferons|ferez|feront|prendre|prends|prend|prennent|prenait|prenais|prenaient|prendrai|prendras|prendra|pris|prise|prises)'

/**
 * Limites de mots autour de la phrase entière.
 * Cas « en finir » : ne pas déclencher sur « en finir avec ce bug ».
 * Autorisé : seul, « avec la vie », « avec tout », « avec ma vie », « avec moi ».
 */
export function matchesDistressPhrase(normalizedHaystack: string, phrase: string): boolean {
  const needle = normalizeForMatch(phrase)
  if (!needle) return false

  if (needle === 'en finir') {
    const pattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])en finir(?!\\s+avec\\b)(?:[^\\p{L}\\p{N}]|$)`,
      'u',
    )
    return pattern.test(normalizedHaystack)
  }

  // « kms » entier, sauf s’il suit un nombre (« 10 kms », « 5 km » n’est pas « kms »).
  if (needle === 'kms') {
    const pattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])(?<!\\d\\s)kms(?:[^\\p{L}\\p{N}]|$)`,
      'u',
    )
    return pattern.test(normalizedHaystack)
  }

  // « je me coupe » sauf ongles / cheveux / barbe / frange.
  if (needle === 'je me coupe') {
    const pattern = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])je me coupe(?!\\s+${JE_ME_COUPE_EXCEPTIONS}\\b)(?:[^\\p{L}\\p{N}]|$)`,
      'u',
    )
    return pattern.test(normalizedHaystack)
  }

  // « overdose » uniquement via formes verbales ciblées ou médicaments/cachets.
  if (needle === 'overdose') {
    const viaVerb = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])${OVERDOSE_VERB}\\s+une\\s+overdose(?:[^\\p{L}\\p{N}]|$)`,
      'u',
    )
    const viaMeds = new RegExp(
      `(?:^|[^\\p{L}\\p{N}])overdose\\s+de\\s+(?:medicaments|cachets)(?:[^\\p{L}\\p{N}]|$)`,
      'u',
    )
    return viaVerb.test(normalizedHaystack) || viaMeds.test(normalizedHaystack)
  }

  const pattern = new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegex(needle)}(?:[^\\p{L}\\p{N}]|$)`,
    'u',
  )
  return pattern.test(normalizedHaystack)
}

/** Niveau 2 — idées suicidaires / auto-agression → message 3114 + 15/(112). */
export const AVIS_MOTS_DETRESSE_NIVEAU_2 = [
  'suicide',
  'suicider',
  'suicidaire',
  'me suicider',
  'je vais me suicider',
  'envie de me suicider',
  'penser au suicide',
  'idees suicidaires',
  'idees noires',
  'me tuer',
  'je vais me tuer',
  'envie de me tuer',
  "me foutre en l'air",
  'me foutre en lair',
  'en finir',
  'en finir avec la vie',
  'en finir avec tout',
  // Validé Vérificateur : « en finir avec ma vie / moi »
  'en finir avec ma vie',
  'en finir avec moi',
  'tout arreter pour de bon',
  'mettre fin a mes jours',
  'mettre fin a ma vie',
  'envie de mourir',
  'envi de mourir',
  'je veux mourir',
  'jveux mourir',
  "j'veux mourir",
  'veux mourir',
  'je voudrais mourir',
  "j'aimerais mourir",
  'plus envie de vivre',
  'pu envie de vivre',
  'envie de plus vivre',
  'marre de vivre',
  "j'en ai marre de vivre",
  'fatigue de vivre',
  'ne plus me reveiller',
  'pas me reveiller',
  'disparaitre pour toujours',
  'personne ne me regretterait',
  'ce serait mieux sans moi',
  'mieux sans moi',
  'me pendre',
  'me jeter sous',
  'sauter du pont',
  'sauter par la fenetre',
  "m'ouvrir les veines",
  'me couper les veines',
  'me scarifier',
  'scarification',
  'je me scarifie',
  'je me coupe',
  'me faire du mal',
  'automutilation',
  'auto mutilation',
  // « overdose » : matching restreint dans matchesDistressPhrase
  'overdose',
  'avaler des cachets',
  'avaler tous mes medicaments',
  // « kms » : matching restreint (pas après un nombre)
  'kms',
  'kill myself',
] as const

/** Niveau 1 — TCA et mal-être → bouton « Besoin d'en parler ? » seulement. */
export const AVIS_MOTS_DETRESSE_NIVEAU_1 = [
  'vomir',
  'me faire vomir',
  'me fais vomir',
  'je me fais vomir',
  'se faire vomir',
  'faire vomir',
  'vomi expres',
  'vomir apres manger',
  'vomir apres avoir mange',
  'jme fais vomir',
  'laxatif',
  'laxatifs',
  'diuretique',
  'diuretiques',
  // « purge » seul retiré (faux positifs cache / données) — garder « me purger »
  'me purger',
  'ne plus manger',
  'ne mange plus',
  'je mange plus rien',
  'jmange plus',
  "j'mange plus",
  'mange pu',
  'je ne mange presque plus',
  'je mange presque plus',
  'arreter de manger',
  'arrete de manger',
  'arret de manger',
  'sauter des repas',
  'je saute des repas',
  'jours sans manger',
  'journee sans manger',
  'rien mange de la journee',
  'jeuner',
  'je jeune pour maigrir',
  'me priver de manger',
  'me priver',
  'me punir',
  'punition apres avoir mange',
  "compenser ce que j'ai mange",
  "bruler ce que j'ai mange",
  'peur de manger',
  'peur de grossir',
  'honte de manger',
  'culpabilise de manger',
  'je culpabilise quand je mange',
  'crise de boulimie',
  'crises de boulimie',
  "crise d'hyperphagie",
  'hyperphagie',
  "manger jusqu'a vomir",
  'boulimie',
  'boulimique',
  'anorexie',
  'anorexique',
  'anorexia',
  'tca',
  'trouble alimentaire',
  'troubles alimentaires',
  'trouble du comportement alimentaire',
  'pro ana',
  'proana',
  'pro mia',
  'thinspo',
  'maigrir a tout prix',
  'je me trouve trop gros',
  'je me trouve trop grosse',
  'je me degoute',
  'me degoute de mon corps',
  'detresse',
  "j'en peux plus",
  'jen peux plus',
  "j'en peux pu",
  'je vais pas bien',
  'ca va pas du tout',
  'je suis a bout',
  'deprime',
  'depression',
] as const

export function detectDistressLevel(texte: string): DistressLevel {
  const normalized = normalizeForMatch(texte)
  for (const phrase of AVIS_MOTS_DETRESSE_NIVEAU_2) {
    if (matchesDistressPhrase(normalized, phrase)) return 2
  }
  for (const phrase of AVIS_MOTS_DETRESSE_NIVEAU_1) {
    if (matchesDistressPhrase(normalized, phrase)) return 1
  }
  return 0
}

export function detectDistressSignals(texte: string): boolean {
  return detectDistressLevel(texte) > 0
}
