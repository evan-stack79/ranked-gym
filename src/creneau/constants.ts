/**
 * Mon créneau salle / marche — imposed phrases & product thresholds (SCIENCE_42, choix A).
 * No medical / score / kcal vocabulary.
 */

export const CRENEAU_FEATURE_NAME = 'Mon créneau' as const

/** Rouge Ranked — seul accent. */
export const CRENEAU_RED = '#ff0702'

/** Mineurs : rentrés avant 20:00 (début « Nuit » S32). */
export const CRENEAU_MINOR_HOME_BEFORE_HM = '20:00'

/** Mineurs : pas de départ avant 06:00 (Q5 / VETO 1). */
export const CRENEAU_MINOR_EARLIEST_HM = '06:00'

/** Adultes : pas de marche dehors après 22:00 (même avec marche du soir). */
export const CRENEAU_ADULT_WALK_CURFEW_HM = '22:00'

/** Info affluence « en direct » vaut 30 min. */
export const CRENEAU_CROWD_LIVE_TTL_MS = 30 * 60 * 1000

/** ≥3 infos récentes concordantes → fiabilité « sûr ». */
export const CRENEAU_CROWD_SURE_MIN = 3

/** Vestiaire par défaut (min). */
export const CRENEAU_DEFAULT_LOCKER_MIN = 10

/** Séance minimale proposée (min). */
export const CRENEAU_DEFAULT_SESSION_MIN = 60

/** Après 22:00 sans info personnel → suppose sans personnel. */
export const CRENEAU_ASSUME_STAFFLESS_AFTER_HM = '22:00'

/** Phrases imposées (mot pour mot, Evan 10× A). */
export const CRENEAU_PHRASES = {
  eveningWalkActivate: 'Le soir, préfère un trajet que tu connais.',
  stafflessActivate: "Sans personnel, c'est mieux d'y aller à deux.",
  heatVigilance: 'Vigilance chaleur aujourd\'hui : on reste au frais.',
  takeBottle: 'Prends ta bouteille.',
  minorEveningHelp:
    'Le soir, on te propose la salle plutôt que dehors. Une question ? Un adulte de confiance peut t\'aider.',
  /** Ligne hero mineur (v5 écran 05) — mot pour mot. */
  minorHeroLine: 'Retour avant 20 h. Un adulte de confiance peut t\'aider.',
  minorHomeBadge: 'Retour avant 20 h',
  sameProtectiveSetting: 'Le même réglage protecteur pour tout le monde.',
  crowdFromCheckins:
    "L'info sur le monde en salle vient des check-ins des utilisateurs.",
  parkEvening: 'Le soir, on évite les parcs : ils peuvent être fermés ou peu éclairés.',
  delayOkPrefix: 'Pas de souci. Avec ce retard, on décale à',
  softSessionAsk: "Pas d'énergie aujourd'hui ?",
  softSessionResult: 'Séance douce notée. On garde le créneau sans forcer.',
  softTomorrow: 'Créneau décalé à demain. Repose-toi.',
  softRest: 'Repose-toi.',
  onSiteAsk: 'Tu y es ? Il y a du monde ?',
  onSiteThanks: 'Merci, c\'est noté.',
  notedPrefix: "C'est noté",
  goButton: "J'y vais",
  imHereButton: 'Je suis là',
  warnSomeone: 'Prévenir quelqu\'un',
  otherTime: 'Autre heure',
  noSessionToday: 'Pas aujourd\'hui',
  backToPlan: 'Retour à mon plan',
  stafflessAtHour: 'Sans personnel à cette heure',
  noCrowdYet: "Pas encore d'avis",
} as const

export type CreneauCrowdLevel = 'calme' | 'moyen' | 'charge'

export const CRENEAU_CROWD_LABEL: Record<CreneauCrowdLevel, string> = {
  calme: 'Calme',
  moyen: 'Moyen',
  charge: 'Chargé',
}

export type CreneauCrowdConfidence = 'sur' | 'a_confirmer' | 'on_apprend'

export const CRENEAU_CONFIDENCE_LABEL: Record<CreneauCrowdConfidence, string> = {
  sur: 'sûr',
  a_confirmer: 'à confirmer',
  on_apprend: 'on apprend ta salle',
}
