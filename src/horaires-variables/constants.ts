/**
 * Emploi du temps variable — constantes produit.
 *
 * AlarmKit limit (état 29) :
 * - Apple documente `AlarmManager.AlarmError.maximumLimitReached` but not the numeric cap
 *   (developer.apple.com/documentation/alarmkit/alarmmanager/alarmerror).
 * - Observed practice on iOS 26.0 ≈ 64 active alarms/app
 *   (https://swiftcrafted.dev/article/alarmkit-ios-26-schedule-alarms-countdown-timers-swiftui).
 * - Product window is 7–14; we arm at most HV_MAX_ARMED_ALARMS = 14.
 */

/** Accent rouge Ranked — seul accent coloré. */
export const HV_RED = '#ff0702'

/**
 * Max AlarmKit alarms we pre-arm for semaines A/B.
 * ≤ undocumented system practice (~64) and ≤ product cap (14).
 */
export const HV_MAX_ARMED_ALARMS = 14

/** Planning horizon in calendar days (A then B or B then A). */
export const HV_PLAN_HORIZON_DAYS = 14

/** Auto-pause after N days without a start time (état 31 A). */
export const HV_AUTO_PAUSE_IDLE_DAYS = 7

/** Default decompression minutes (0–120). */
export const HV_DEFAULT_DECOMPRESSION_MIN = 60

/** Soft wake default for rest days. */
export const HV_REST_SOFT_WAKE_HM = '10:30'

/** Sunday reminder window (inclusive), local clock. */
export const HV_SUNDAY_REMINDER_MIN_HM = '18:00'
export const HV_SUNDAY_REMINDER_MAX_HM = '21:00'

/** Feature display name — single source of truth (never the legacy réveil-sheet label). */
export const HV_FEATURE_NAME = 'Emploi du temps variable'
export const HV_FEATURE_SUBTITLE = 'Ton réveil suit tes horaires'

/** Exact minor phrases (veto 12 A). */
export const HV_MINOR_BODY_PHRASE =
  'À ton âge, le corps aime 8 à 10 h. Ce soir, couche-toi dès que tu peux.'
export const HV_MINOR_ADULT_HELP =
  "Une question sur tes horaires ? Un adulte de confiance peut t'aider."
export const HV_MINOR_NO_NIGHT_MODE = 'Pas de mode « Nuit » avant 18 ans.'

/** Short-night driving line (veto 15 A) — passive, required. */
export const HV_SHORT_NIGHT_DRIVE =
  'Après une nuit très courte, si tu as sommeil, évite de prendre le volant.'

/** Night screen confirm (état 32). */
export const HV_NIGHT_CONFIRM = "C'est noté. Rendors-toi tranquille."

/** Water day copy (état 26). */
export const HV_WATER_DAY_PHRASE =
  "Ta journée d'eau va de ton lever à ton lever suivant."
