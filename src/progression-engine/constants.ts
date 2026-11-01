/** Constantes du moteur de progression. Jeu, pas score clinique. */

export const XP_PER_LEVEL = 1000
export const XP_SESSION_CAP = 250
export const XP_BASE = 40
export const XP_PER_DONE_SET = 4
export const XP_SET_BONUS_CAP = 80
export const XP_STRAIN_FACTOR = 0.6
export const XP_QUALITY_LOADS = 10
export const XP_QUALITY_RPE = 10
export const XP_QUALITY_PR = 25

export const PREPARATION_WEIGHT_SLEEP = 0.45
export const PREPARATION_WEIGHT_BANK = 0.25
export const PREPARATION_WEIGHT_REGULARITY = 0.15
export const PREPARATION_WEIGHT_YESTERDAY = 0.15
export const PREPARATION_WITHIN_TARGET_MIN = 67
export const PREPARATION_WITHIN_TARGET_MULTIPLIER = 1.15
export const SLEEP_DEBT_XP_THRESHOLD_MIN = -180
export const SLEEP_DEBT_XP_MULTIPLIER = 0.9

/** Échelle si la médiane 28 jours est absente — cold start XP strain. */
export const STRAIN_SCALE_FALLBACK = 150
export const STRAIN_Z_MIN_DAYS = 7
export const STRAIN_Z_SD_FLOOR = 4
export const STRAIN_Z_WITHIN = 0.5

export const SLEEP_BANK_MIN_NIGHTS = 3
export const SLEEP_BANK_DEFAULT_GOAL_MINUTES = 8 * 60

export const RPE_NEUTRAL = 7
export const RPE_FACTOR_PER_POINT = 0.04
export const RPE_FACTOR_MIN = 0.76
export const RPE_FACTOR_MAX = 1.12
export const BODYWEIGHT_REFERENCE_KG = 75

export const MUSCLE_PRIMARY_SHARE = 0.7
export const MUSCLE_SECONDARY_SHARE = 0.3
export const HALF_LIFE_SMALL_HOURS = 36
export const HALF_LIFE_MEDIUM_HOURS = 48
export const HALF_LIFE_LARGE_HOURS = 60

export const PERFORMANCE_RATING_START = 1000
export const PERFORMANCE_RATING_FLOOR = 800
export const PERFORMANCE_RATING_CAP = 4000
export const ELO_K_NEW = 24
export const ELO_K_ESTABLISHED = 16
export const ELO_ESTABLISHED_SESSIONS = 15

export const LOAD_RATIO_MIN_ACTIVE_DAYS = 4
export const LOAD_RATIO_LOW = 0.8
export const LOAD_RATIO_HIGH = 1.3
export const ATL_DAYS = 7
export const CTL_DAYS = 42
