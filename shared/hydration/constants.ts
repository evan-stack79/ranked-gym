/**
 * Hydratation v0 — constantes figées Vérificateur §9 / Archi §2.
 * Source unique client + serveur. Aucune autre formule (pas de poids×ml).
 */

/** C-HY1 — objectif par défaut « eau bue seule ». */
export const GOAL_DEFAULT_ML = 1500

/** C-HY2 — bornes curseur objectif (réglage, pas limite santé). */
export const GOAL_MIN_ML = 1000
export const GOAL_MAX_ML = 3000
export const GOAL_STEP_ML = 100

/** C-HY3 — total jour ≥ seuil → message doux, aucune félicitation. */
export const HIGH_INFO_THRESHOLD_ML = 3000

/** HY-15 — verre par défaut. */
export const GLASS_ML = 250

/** HY-01 — bouteille classique 2 L. */
export const CLASSIC_BOTTLE_ML = 2000

/** Bouteille Cristaline / classique 1,5 L. */
export const CLASSIC_BOTTLE_15_ML = 1500

/** Volume saisi Ma bouteille (prudence Archi, vérifié serveur). */
export const CONTAINER_MIN_ML = 50
export const CONTAINER_MAX_ML = 5000

/** Entrée individuelle (montant). */
export const ENTRY_MIN_ML = 1
export const ENTRY_MAX_ML = 5000

/** HY-11 — rappels. */
export const REMINDERS_MAX_PER_DAY = 3
/** Quiet hours inclusive start / exclusive end (local). Nuit 21h–8h. */
export const QUIET_START = '21:00'
export const QUIET_END = '08:00'
/** Créneaux opt-in par défaut (Evan). */
export const DEFAULT_REMINDER_TIMES = ['10:00', '14:00', '18:00'] as const

/** Notification locale ids fixes (Archi §6). */
export const REMINDER_NOTIFICATION_IDS = [7101, 7102, 7103] as const

/** Volumes rapides Ma bouteille (écran 5). */
export const MY_BOTTLE_PRESET_ML = [500, 750, 1000, 1500] as const

export const HYDRATION_MODES = ['classic_15', 'classic_2l', 'glasses_250', 'my_bottle'] as const
export type HydrationMode = (typeof HYDRATION_MODES)[number]

/** Ligne exacte sous le curseur objectif (WaterGoalSlider / bulle « i »). */
export const MSG_GOAL_RANGE =
  'Réglable de 1 L à 3 L — repère, pas limite de santé.'

export const HYDRATION_ENTRY_SOURCES = [
  'glass',
  'half_bottle',
  'full_bottle',
  'slider',
] as const
export type HydrationEntrySource = (typeof HYDRATION_ENTRY_SOURCES)[number]

/** C-HY4 — libellé affiché. */
export const LABEL_EAU_BUE_SEULE = 'Eau bue seule'

/** Messages fixes Vérificateur §9 — copie exacte. */
export const MSG_PERMANENT =
  'Les aliments et les autres boissons apportent aussi de l’eau ; ils ne sont pas comptés ici.'

export const MSG_HIGH_INFO =
  'L’objectif est un repère, pas un défi : boire plus n’apporte aucun bonus, et les besoins varient selon la journée.'

export const MSG_SPORT_HEAT =
  'Pendant le sport et quand il fait chaud, tu peux boire selon ta soif, sans chercher à finir l’objectif.'

export const MSG_PREGNANCY =
  'Pour un repère adapté, tu peux en parler à ta sage-femme ou à ton médecin.'

export const MSG_MEDICAL_LIMIT =
  'Si un médecin t’a donné une limite, suis-la.'

export const MSG_REMINDER_BODY = 'Une gorgée d’eau ?'

export const MSG_NEUTRAL_UNDER =
  'Demain est un autre jour.'

export const MSG_NEUTRAL_OK = 'Bien joué'

/**
 * M7 (EFSA 2010 / Vérificateur) — mineurs & âge inconnu.
 * 1500 mL reste le défaut non modifiable ; libellé « repère », jamais « objectif ».
 */
export const LABEL_REPERE_JOUR = 'Repère du jour'

export const MSG_MINOR_PERMANENT =
  'Les aliments et autres boissons apportent aussi de l’eau.'

export const MSG_REPERE_LOCKED = 'Le repère n’est pas réglable ici.'

/** Pause rappels mineurs — neutre, sans réussite / célébration. */
export const MSG_REMINDER_PAUSE_NEUTRAL =
  'Les rappels du jour sont en pause jusqu’à demain.'

/** Pause rappels adultes (libellé objectif inchangé). */
export const MSG_REMINDER_PAUSE_GOAL =
  'Objectif du jour atteint — les rappels restants sont en pause jusqu’à demain.'

/** Texte Pro upsell — sans rang / points (HY-13). */
export const MSG_PRO_BOTTLE =
  'Ma bouteille est un avantage Pass Pro cosmétique : ta photo découpée sur l’appareil.'

/**
 * M1 — clientId stable pour une entrée legacy `nutrition_water_entries.entryId`
 * (idempotent ; jamais de double compte une fois migrée).
 */
export const LEGACY_WATER_CLIENT_PREFIX = 'legacy:'

/** Total journal local sans entrées discrètes (dayKey). */
export const LEGACY_WATER_DAY_PREFIX = 'legacy-day:'

/** Aligné NUTRITION_ADULT_MIN — majorité pour objectif hydratation. */
export const HYDRATION_ADULT_MIN_AGE = 18

export function legacyWaterEntryClientId(entryId: string): string {
  return `${LEGACY_WATER_CLIENT_PREFIX}${entryId}`
}

export function legacyWaterDayClientId(dayKey: string): string {
  return `${LEGACY_WATER_DAY_PREFIX}${dayKey}`
}

export function isLegacyHydrationClientId(clientId: string): boolean {
  return (
    clientId.startsWith(LEGACY_WATER_CLIENT_PREFIX)
    || clientId.startsWith(LEGACY_WATER_DAY_PREFIX)
  )
}

/** M7 — mineur / âge inconnu → toujours GOAL_DEFAULT_ML (ignore cible stockée). */
export function effectiveHydrationGoalMl(
  storedGoalMl: number,
  age: number | null | undefined,
): number {
  if (age == null || age < HYDRATION_ADULT_MIN_AGE) return GOAL_DEFAULT_ML
  return storedGoalMl
}
