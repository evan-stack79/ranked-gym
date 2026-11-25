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
  6: 'Bois plus tôt',
  7: 'Ces boissons comptent',
  8: 'Grosse séance',
  9: "Pas fan de l'eau plate",
  10: 'Une bouteille = un tap',
}

/** Section B — Texte (exact). */
export const ETAT_TEXTES: Record<number, string> = {
  1: "Tu as le droit d'être tranquille. Bois juste avant de partir, ton corps garde le reste pour plus tard.",
  2: 'Avec l’âge, la soif prévient parfois moins bien. Ton café, ton thé et ta soupe comptent aussi !',
  3: 'Pas envie de compter ? Aucun souci. Le module reste là si un jour tu en as besoin.',
  4: 'Tu peux arrêter de compter un moment. Rien n’est perdu.',
  5: 'Bravo, ton objectif est atteint ! Pour le reste de la journée, laisse ta soif décider.',
  6: 'Tu bois bien ! Bois un peu plus tôt, tes nuits seront plus calmes.',
  7: 'Ces boissons comptent comme de l’eau. Tu veux en remplacer une par jour par de l’eau pétillante ?',
  8: 'Grosse séance ! Ton corps a transpiré : écoute ta soif dans l’heure qui vient.',
  9: 'Pas fan de l’eau plate ? Pas de souci : eau pétillante, infusion ou eau au citron, ça compte !',
  10: 'Un jour sans noter, ce n’est rien. Une seule saisie par bouteille, et c’est réglé !',
}

/** Aide 02 — Option A (exact). */
export const AIDE_02 =
  'Si on t’a donné une limite pour boire, c’est elle qui compte.'

/** Aide 05 — Option A (exact). */
export const AIDE_05 = 'Boire bien plus que sa soif n’aide pas. Écoute ta soif.'

/** Aide 07 adulte — maquette aide_etat_07 (compteur en boissons, pas en mg). */
export const AIDE_07_ADULT =
  'Café, soda et jus : dans ton eau totale. Thé, eau gazeuse, infusion et eau au citron : aussi dans l’eau bue.'

/** Aide 07 mineur — maquette aide_etat_07_mineur (jamais de boisson caféinée proposée). */
export const AIDE_07_MINOR =
  'Soda et jus apportent bien de l’eau. Ils comptent dans ton eau totale, et l’eau gazeuse au citron compte dans ton eau bue.'

export const AIDE_07_PRIVACY =
  'Personne d’autre ne voit ces données. Ton eau est sauvée sur ton compte.'

export const AIDE_07_SWAPS_ADULT: Array<{ from: string; to: string }> = [
  { from: 'Soda', to: 'eau gazeuse au citron' },
  { from: 'Soda', to: 'thé glacé maison, sans sucre' },
]

export const AIDE_07_SWAPS_MINOR: Array<{ from: string; to: string }> = [
  { from: 'Soda', to: 'eau gazeuse au citron' },
  { from: 'Boisson énergisante', to: 'infusion froide maison' },
]

/** Section B — Actions (fidèles au doc). */
const ACTIONS: Record<number, string[]> = {
  1: [
    'Bois avant de partir et en arrivant, plutôt que pendant le trajet.',
    'Petites gorgées régulières plutôt qu’une grande quantité d’un coup.',
    'Fiche « eau qui se mange » : fruits, légumes, soupes, laitages.',
  ],
  2: [
    'Compter toutes les boissons (thé, café, lait, soupe) dans le total.',
    '3 petits rappels aux repas',
    'L’objectif ne monte jamais tout seul.',
  ],
  3: [
    'Pas de rappel, pas de badge.',
    'Tu peux cacher l’Eau.',
    'Une seule carte discrète dans l’app au maximum une fois par mois : « Les aliments et les autres boissons apportent aussi de l’eau ».',
  ],
  4: [
    'Sans chiffres : juste 3 coches, matin, midi, soir.',
    'Pause 7 jours, sans rappels.',
    'Retour progressif proposé, jamais imposé.',
  ],
  5: [
    'Objectif atteint : plus de rappels, pas d’animation de dépassement.',
    'Message doux dès 3,0 L.',
    'Tu bois sans soif pour finir l’objectif ? Baisse-le, et bois selon ta soif.',
  ],
  6: [
    '3 rappels de jour (10 h, 13 h, 16 h), coupés après 19 h.',
    'Repère visuel : « moitié de la bouteille à 14 h ».',
    'Goutte grise = 2 h avant ton coucher.',
  ],
  7: [
    'Café, cola, jus et boissons énergisantes : dans le total, pas dans « Eau bue seule ». Le thé compte aussi dans « Eau bue seule ».',
    'Compteur de caféine du jour, seulement si le type est saisi.',
    'Un échange par jour proposé : par exemple un soda remplacé par une eau gazeuse au citron.',
  ],
  8: [
    'Avant la séance : prends ta bouteille.',
    'Après : bois selon ta soif dans l’heure qui suit.',
    'Aucun ajout automatique à l’objectif.',
  ],
  9: [
    'Eau gazeuse, infusions sans sucre et eau aromatisée maison (fruits, menthe) comptent comme de l’eau.',
    '3 recettes simples d’eau aromatisée maison.',
    'Fiche « eau qui se mange », sans proposer de boisson sucrée.',
  ],
  10: [
    'Une bouteille entière = un tap.',
    'Ta flamme ne s’éteint pas.',
    'Rater un jour ne casse rien.',
  ],
}

/** Mineurs (état 7 option B) : never suggest caffeinated drinks. */
const ACTIONS_7_MINOR: string[] = [
  'Café, cola, jus et boissons énergisantes : dans le total, pas dans « Eau bue seule ». Le thé compte aussi dans « Eau bue seule ».',
  'Compteur de caféine du jour, seulement si le type est saisi.',
  'Une fois par jour, remplace une boisson par de l’eau pétillante, une infusion ou de l’eau au citron. Jamais de boisson caféinée proposée.',
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
