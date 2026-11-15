/**
 * Textes MOT POUR MOT — SCIENCE_10_ETATS.md section B (+ aide D option A).
 * Titles courts : ANIMATIONS.md.
 */

export type EtatTextVariant = 'minor' | 'adult'

/** Titles courts from ANIMATIONS.md */
export const ETAT_TITLES: Record<number, string> = {
  1: 'Tranquille en sortie',
  2: 'Tout ce que tu bois compte',
  3: 'Pas envie de compter',
  4: 'Pause du comptage',
  5: 'Objectif atteint',
  6: 'Avancer tes verres',
  7: 'Ces boissons comptent',
  8: 'Grosse séance',
  9: "Pas fan de l'eau plate",
  10: 'Une saisie par bouteille',
}

/** Section B — Texte (exact). */
export const ETAT_TEXTES: Record<number, string> = {
  1: 'Tu as le droit de vouloir être tranquille. Bois juste avant de partir : ton corps garde le reste pour plus tard.',
  2: 'Avec l’âge, la soif prévient parfois moins bien. Ton café, ton thé et ta soupe comptent aussi !',
  3: 'Pas envie de compter ? Aucun souci. Le module reste là si un jour tu en as besoin.',
  4: 'Ton corps sait aussi te guider. Tu peux faire une pause du comptage : rien n’est perdu.',
  5: 'Bravo, ton objectif est atteint ! Pour le reste de la journée, laisse ta soif décider.',
  6: 'Tu bois bien sur la journée ! En avançant un peu tes verres, tes nuits seront plus calmes.',
  7: 'Ces boissons comptent comme de l’eau. Tu veux en remplacer une par jour par de l’eau pétillante ?',
  8: 'Grosse séance ! Ton corps a transpiré : écoute ta soif dans l’heure qui vient.',
  9: 'Pas fan de l’eau plate ? Pas de souci : eau pétillante, infusion ou eau au citron, ça compte !',
  10: 'Un jour sans noter, ce n’est rien. Une seule saisie par bouteille, et c’est réglé !',
}

/** Aide 02 — Option A (exact). */
export const AIDE_02 =
  'Si on t’a donné une limite pour boire, c’est elle qui compte.'

/** Aide 05 — Option A (exact). */
export const AIDE_05 =
  'Boire bien plus que sa soif n’aide pas ; si tu te sens mal après avoir beaucoup bu, un pro de santé peut aider.'

/** Aide 07 adulte — maquette aide_etat_07 (compteur en boissons, pas en mg). */
export const AIDE_07_ADULT =
  'Café, thé, soda et jus apportent bien de l’eau. Ils comptent dans ton eau totale, et l’eau gazeuse au citron compte dans ton eau bue.'

/** Aide 07 mineur — maquette aide_etat_07_mineur (jamais de boisson caféinée proposée). */
export const AIDE_07_MINOR =
  'Soda et jus apportent bien de l’eau. Ils comptent dans ton eau totale, et l’eau gazeuse au citron compte dans ton eau bue.'

export const AIDE_07_PRIVACY =
  'L’app voit seulement ce que tu notes. Tout reste sur ton téléphone.'

export const AIDE_07_SWAPS_ADULT: Array<{ from: string; to: string }> = [
  { from: 'Soda', to: 'eau gazeuse au citron' },
  { from: 'Soda', to: 'thé glacé maison, sans sucre' },
]

export const AIDE_07_SWAPS_MINOR: Array<{ from: string; to: string }> = [
  { from: 'Soda', to: 'eau gazeuse au citron' },
  { from: 'Canette énergisante', to: 'infusion froide maison' },
]

/** Section B — Actions (fidèles au doc). */
const ACTIONS: Record<number, string[]> = {
  1: [
    'Mode « je pars » : un rappel pour boire avant de partir et à l’arrivée, plutôt que pendant le trajet.',
    'Petites gorgées régulières plutôt qu’une grande quantité d’un coup.',
    'Fiche « eau qui se mange » : fruits, légumes, soupes, laitages.',
  ],
  2: [
    'Compter toutes les boissons (thé, café, lait, soupe) dans le total.',
    '3 rappels doux liés aux repas.',
    'Aucune hausse automatique de l’objectif.',
  ],
  3: [
    'Zéro push, zéro rappel, zéro badge.',
    'Possibilité de masquer le module en un tap.',
    'Une seule carte discrète dans l’app au maximum une fois par mois : « Les aliments et les autres boissons apportent aussi de l’eau ».',
  ],
  4: [
    'Mode « sans compter » : les chiffres sont masqués ; seulement 3 coches (matin, midi, soir).',
    'Pause de 7 jours en un tap, rappels coupés.',
    'Retour progressif proposé, jamais imposé.',
  ],
  5: [
    'Objectif atteint : rappels coupés et barre pleine, sans animation de « dépassement ».',
    'Message doux dès 3,0 L.',
    'Si tu bois sans soif pour finir l’objectif : proposer de baisser l’objectif, avec « boire selon ta soif ».',
  ],
  6: [
    '3 rappels de jour (10 h, 13 h, 16 h), coupés après 19 h.',
    'Repère visuel : « moitié de la bouteille à 14 h ».',
    'Lien Sommeil : si l’heure de coucher est connue, une goutte grise apparaît 2 h avant.',
  ],
  7: [
    'Compter ces boissons dans le total, mais pas dans « Eau bue seule ».',
    'Compteur de caféine du jour, seulement si le type est saisi.',
    'Un échange par jour proposé : par exemple un soda remplacé par une eau gazeuse au citron.',
  ],
  8: [
    'Carte avant la séance : « Prends ta bouteille ».',
    'Carte après : « Bois selon ta soif dans l’heure qui suit ».',
    'Aucun ajout automatique à l’objectif.',
  ],
  9: [
    'Eau gazeuse, infusions sans sucre et eau aromatisée maison (fruits, menthe) comptent comme de l’eau.',
    '3 recettes simples d’eau aromatisée maison.',
    'Fiche « eau qui se mange », sans proposer de boisson sucrée.',
  ],
  10: [
    'Saisie en un tap : « bouteille entière » (contenance enregistrée une fois), widget d’écran d’accueil, raccourci.',
    'Pas de série ni de flamme perdue.',
    'Un seul message de retour, dans l’app et non en push : rater un jour ne casse pas une habitude.',
  ],
}

/** Mineurs (état 7 option B) : never suggest caffeinated drinks. */
const ACTIONS_7_MINOR: string[] = [
  'Compter ces boissons dans le total, mais pas dans « Eau bue seule ».',
  'Compteur de caféine du jour, seulement si le type est saisi.',
  'Un échange par jour proposé : remplacer une boisson par de l’eau pétillante, une infusion ou de l’eau au citron (jamais de boisson caféinée suggérée).',
]

export function getEtatTexte(id: number): string {
  return ETAT_TEXTES[id] ?? ''
}

export function getEtatActions(
  id: number,
  variant?: EtatTextVariant,
): string[] {
  if (id === 7 && variant === 'minor') return [...ACTIONS_7_MINOR]
  return [...(ACTIONS[id] ?? [])]
}

export function getEtatAide(
  id: number,
  variant?: EtatTextVariant,
): string | undefined {
  if (id === 2) return AIDE_02
  if (id === 5) return AIDE_05
  if (id === 7) return variant === 'minor' ? AIDE_07_MINOR : AIDE_07_ADULT
  return undefined
}

export function getEtatTitle(id: number): string {
  return ETAT_TITLES[id] ?? ''
}
