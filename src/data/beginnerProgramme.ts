/**
 * Programme « Débutant » — validé §10 bis.
 * Full body, 2×/sem, 1 série au départ (jusqu’à 3), 8–12 reps.
 */

export const BEGINNER_PROGRAMME_ID = 'programme-debutant' as const
export const BEGINNER_PROGRAMME_TITLE = 'Débutant' as const
export const BEGINNER_PROGRAMME_SUBTITLE = 'Full body · 2 séances / semaine' as const

export const BEGINNER_TARGET_REPS_MIN = 8
export const BEGINNER_TARGET_REPS_MAX = 12
export const BEGINNER_SETS_START = 1
export const BEGINNER_SETS_MAX = 3

/** Repos : gros mouvements 2–3 min ; isolation 1–2 min. */
export const BEGINNER_REST_BIG_SEC = 150 // milieu 2–3 min
export const BEGINNER_REST_SMALL_SEC = 90 // milieu 1–2 min

export const GAINAGE_HOLD_TEXT =
  "Tiens tant que ton dos reste droit. Arrête avant d'avoir mal." as const

export type BeginnerSlotKind = 'lift' | 'gainage'

export type BeginnerExerciseSlot = {
  /** Ordre 1-based. */
  order: number
  /** Identifiant catalogue machine (ou gainage). */
  catalogId: string
  /** Nom affiché exact. */
  name: string
  kind: BeginnerSlotKind
  /** Gros = 2–3 min repos ; petit = 1–2 min. */
  size: 'big' | 'small'
  /**
   * Swap « Machine prise » — autre catalogId (historique de charge séparé).
   * null = pas de swap (on saute l’exo).
   */
  machineBusySwapId: string | null
  machineBusySwapName: string | null
}

/**
 * Ordre validé :
 * 1 Presse à cuisses
 * 2 Leg curl assis
 * 3 Développé poitrine à la machine
 * 4 Tirage vertical à la poulie
 * 5 Rowing assis à la poulie
 * 6 Développé épaules à la machine
 * 7 Gainage sur les avant-bras
 */
export const BEGINNER_EXERCISES: readonly BeginnerExerciseSlot[] = [
  {
    order: 1,
    catalogId: 'leg_press',
    name: 'Presse à cuisses',
    kind: 'lift',
    size: 'big',
    machineBusySwapId: 'goblet_squat',
    machineBusySwapName: 'Squat avec un haltère contre la poitrine',
  },
  {
    order: 2,
    catalogId: 'seated_leg_curl',
    name: 'Leg curl assis',
    kind: 'lift',
    size: 'small',
    machineBusySwapId: null,
    machineBusySwapName: null,
  },
  {
    order: 3,
    catalogId: 'chest_press_machine',
    name: 'Développé poitrine à la machine',
    kind: 'lift',
    size: 'big',
    machineBusySwapId: 'dumbbell_bench_press',
    machineBusySwapName: 'Développé couché haltères',
  },
  {
    order: 4,
    catalogId: 'lat_pulldown',
    name: 'Tirage vertical à la poulie',
    kind: 'lift',
    size: 'big',
    machineBusySwapId: 'single_arm_dumbbell_row',
    machineBusySwapName: 'Rowing un bras haltère',
  },
  {
    order: 5,
    catalogId: 'seated_cable_row',
    name: 'Rowing assis à la poulie',
    kind: 'lift',
    size: 'big',
    machineBusySwapId: 'single_arm_dumbbell_row',
    machineBusySwapName: 'Rowing un bras haltère',
  },
  {
    order: 6,
    catalogId: 'shoulder_press_machine',
    name: 'Développé épaules à la machine',
    kind: 'lift',
    size: 'big',
    machineBusySwapId: 'seated_dumbbell_press',
    machineBusySwapName: 'Développé assis haltères',
  },
  {
    order: 7,
    catalogId: 'forearm_plank',
    name: 'Gainage sur les avant-bras',
    kind: 'gainage',
    size: 'small',
    machineBusySwapId: null,
    machineBusySwapName: null,
  },
] as const

/** Suggestion de charge : +2 % à +10 % max, jamais forcée. */
export const LOAD_SUGGEST_MIN_PCT = 0.02
export const LOAD_SUGGEST_MAX_PCT = 0.1
/** 1–2 reps au-dessus de la cible, deux séances d’affilée. */
export const LOAD_SUGGEST_EXTRA_REPS_MIN = 1
export const LOAD_SUGGEST_EXTRA_REPS_MAX = 2
