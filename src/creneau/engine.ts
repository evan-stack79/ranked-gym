/**
 * Mon créneau — pure safety + slot helpers (SCIENCE_42, 10× choix A).
 * No Convex. No Google. No medical / score / kcal copy.
 */

import {
  CRENEAU_ADULT_WALK_CURFEW_HM,
  CRENEAU_ASSUME_STAFFLESS_AFTER_HM,
  CRENEAU_CROWD_LIVE_TTL_MS,
  CRENEAU_CROWD_SURE_MIN,
  CRENEAU_DEFAULT_LOCKER_MIN,
  CRENEAU_DEFAULT_SESSION_MIN,
  CRENEAU_MINOR_HOME_BEFORE_HM,
  CRENEAU_PHRASES,
  type CreneauCrowdConfidence,
  type CreneauCrowdLevel,
  CRENEAU_CROWD_LABEL,
  CRENEAU_CONFIDENCE_LABEL,
} from './constants'

export type CreneauActivity = 'salle' | 'marche'

export type CreneauHm = string // HH:MM

export function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function formatHm(totalMin: number): CreneauHm {
  const n = ((Math.round(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function addMinutes(hm: CreneauHm, deltaMin: number): CreneauHm | null {
  const base = parseHm(hm)
  if (base == null) return null
  return formatHm(base + deltaMin)
}

/** Mineur 15–17 (app min 15). Age inconnu → mode protecteur mineur. */
export function isCreneauMinor(age: number | null | undefined): boolean {
  if (age == null || !Number.isFinite(age)) return true
  return age < 18
}

export type SlotSafetyInput = {
  age: number | null
  activity: CreneauActivity
  /** Départ (maison ou travail). */
  departureHm: CreneauHm
  /** Arrivée à la maison (état 2). */
  returnHomeHm: CreneauHm
  /** Trajet / séance après coucher du soleil. */
  afterSunset: boolean
  heatVigilance: boolean
  /** Salle avec personnel à l'heure de la séance. */
  staffed: boolean
  /** Parcours marche passant par un parc. */
  throughPark: boolean
  /** Adulte a activé « Je marche aussi le soir ». */
  eveningWalkEnabled: boolean
  /** Adulte a activé « Salle sans personnel ». */
  stafflessGymEnabled: boolean
}

export type SlotSafetyVerdict = {
  allowed: boolean
  reasons: string[]
  /** Banners / help lines to show (imposed phrases). */
  lines: string[]
}

/**
 * Safety gate — profile + VETO before crowd.
 * Adults: never park evening; no walk after 22:00.
 * Minors: home before 20:00; day-only walk; never staffless.
 * Everyone: no walk under heat vigilance.
 */
export function evaluateSlotSafety(input: SlotSafetyInput): SlotSafetyVerdict {
  const minor = isCreneauMinor(input.age)
  const reasons: string[] = []
  const lines: string[] = []
  const dep = parseHm(input.departureHm)
  const ret = parseHm(input.returnHomeHm)
  const homeLimit = parseHm(CRENEAU_MINOR_HOME_BEFORE_HM)!
  const walkCurfew = parseHm(CRENEAU_ADULT_WALK_CURFEW_HM)!

  if (dep == null || ret == null) {
    return { allowed: false, reasons: ['horaire_invalide'], lines: [] }
  }

  if (input.heatVigilance) {
    lines.push(CRENEAU_PHRASES.heatVigilance)
    lines.push(CRENEAU_PHRASES.takeBottle)
    if (input.activity === 'marche') {
      reasons.push('chaleur_marche')
      return { allowed: false, reasons, lines }
    }
  }

  if (minor) {
    lines.push(CRENEAU_PHRASES.minorEveningHelp)
    if (ret >= homeLimit) {
      reasons.push('mineur_retour_apres_20h')
    }
    if (input.activity === 'marche' && input.afterSunset) {
      reasons.push('mineur_marche_nuit')
    }
    if (input.activity === 'salle' && !input.staffed) {
      reasons.push('mineur_salle_sans_personnel')
    }
    return { allowed: reasons.length === 0, reasons, lines }
  }

  // Adult defaults
  if (input.activity === 'marche') {
    if (input.throughPark && input.afterSunset) {
      reasons.push('parc_soir')
      lines.push(CRENEAU_PHRASES.parkEvening)
    }
    if (ret >= walkCurfew || dep >= walkCurfew) {
      reasons.push('marche_apres_22h')
    }
    if (input.afterSunset && !input.eveningWalkEnabled) {
      reasons.push('marche_soir_non_activee')
    }
  }

  if (input.activity === 'salle' && !input.staffed) {
    if (!input.stafflessGymEnabled) {
      reasons.push('salle_sans_personnel_non_activee')
    }
  }

  return { allowed: reasons.length === 0, reasons, lines }
}

export function assumeStaffedAt(sessionHm: CreneauHm, staffUntilHm: CreneauHm | null): boolean {
  const session = parseHm(sessionHm)
  if (session == null) return false
  if (staffUntilHm) {
    const until = parseHm(staffUntilHm)
    if (until == null) return false
    return session < until
  }
  const assume = parseHm(CRENEAU_ASSUME_STAFFLESS_AFTER_HM)!
  return session < assume
}

export type ProposedSlot = {
  activity: CreneauActivity
  gymId: string | null
  gymName: string
  favorite: boolean
  departureHm: CreneauHm
  sessionStartHm: CreneauHm
  sessionEndHm: CreneauHm
  returnHm: CreneauHm
  soft: boolean
}

export type ProposeArgs = {
  age: number | null
  nowHm: CreneauHm
  afterSunset: boolean
  heatVigilance: boolean
  eveningWalkEnabled: boolean
  stafflessGymEnabled: boolean
  preferQuiet: boolean
  softSession: boolean
  delayMin: number
  favorite: { id: string; name: string; staffUntilHm: string | null; travelMin: number } | null
  backup: { id: string; name: string; staffUntilHm: string | null; travelMin: number } | null
  lockerMin?: number
  sessionMin?: number
  /** Prefer marche when daylight + no heat (adult/minor rules still apply). */
  preferWalk?: boolean
}

/**
 * Build one primary slot (+ optional plan B gym) respecting safety.
 * If favorite fails safety, try backup; if walk fails, fall back to salle.
 */
export function proposeCreneau(args: ProposeArgs): {
  primary: ProposedSlot | null
  planB: ProposedSlot | null
  safety: SlotSafetyVerdict
  banners: string[]
} {
  const locker = args.lockerMin ?? CRENEAU_DEFAULT_LOCKER_MIN
  const sessionMin = args.softSession
    ? Math.min(30, args.sessionMin ?? CRENEAU_DEFAULT_SESSION_MIN)
    : (args.sessionMin ?? CRENEAU_DEFAULT_SESSION_MIN)
  const banners: string[] = []
  if (args.heatVigilance) {
    banners.push(CRENEAU_PHRASES.heatVigilance, CRENEAU_PHRASES.takeBottle)
  }
  if (isCreneauMinor(args.age)) {
    banners.push(CRENEAU_PHRASES.minorEveningHelp)
  }

  const tryGym = (
    gym: NonNullable<ProposeArgs['favorite']>,
    favorite: boolean,
  ): { slot: ProposedSlot; verdict: SlotSafetyVerdict } | null => {
    const travel = gym.travelMin
    const baseDep = addMinutes(args.nowHm, Math.max(0, args.delayMin))!
    // Leave soon: départ = now+delay, séance = départ + travel + locker
    const departureHm = baseDep
    const sessionStartHm = addMinutes(departureHm, travel + locker)!
    const sessionEndHm = addMinutes(sessionStartHm, sessionMin)!
    const returnHm = addMinutes(sessionEndHm, locker + travel)!
    const staffed = assumeStaffedAt(sessionStartHm, gym.staffUntilHm)
    const verdict = evaluateSlotSafety({
      age: args.age,
      activity: 'salle',
      departureHm,
      returnHomeHm: returnHm,
      afterSunset: args.afterSunset,
      heatVigilance: args.heatVigilance,
      staffed,
      throughPark: false,
      eveningWalkEnabled: args.eveningWalkEnabled,
      stafflessGymEnabled: args.stafflessGymEnabled,
    })
    if (!verdict.allowed) return null
    return {
      slot: {
        activity: 'salle',
        gymId: gym.id,
        gymName: gym.name,
        favorite,
        departureHm,
        sessionStartHm,
        sessionEndHm,
        returnHm,
        soft: args.softSession,
      },
      verdict,
    }
  }

  const tryWalk = (): { slot: ProposedSlot; verdict: SlotSafetyVerdict } | null => {
    if (args.heatVigilance) return null
    const travel = 15
    const departureHm = addMinutes(args.nowHm, Math.max(0, args.delayMin))!
    const sessionStartHm = addMinutes(departureHm, 5)!
    const sessionEndHm = addMinutes(sessionStartHm, args.softSession ? 20 : 40)!
    const returnHm = addMinutes(sessionEndHm, travel)!
    const verdict = evaluateSlotSafety({
      age: args.age,
      activity: 'marche',
      departureHm,
      returnHomeHm: returnHm,
      afterSunset: args.afterSunset,
      heatVigilance: false,
      staffed: true,
      throughPark: false,
      eveningWalkEnabled: args.eveningWalkEnabled,
      stafflessGymEnabled: args.stafflessGymEnabled,
    })
    if (!verdict.allowed) return null
    return {
      slot: {
        activity: 'marche',
        gymId: null,
        gymName: 'Marche',
        favorite: false,
        departureHm,
        sessionStartHm,
        sessionEndHm,
        returnHm,
        soft: args.softSession,
      },
      verdict,
    }
  }

  let primary: ProposedSlot | null = null
  let safety: SlotSafetyVerdict = { allowed: false, reasons: ['aucun_creneau'], lines: banners }
  let planB: ProposedSlot | null = null

  if (args.preferWalk && !args.afterSunset) {
    const w = tryWalk()
    if (w) {
      primary = w.slot
      safety = w.verdict
    }
  }

  if (!primary && args.favorite) {
    const f = tryGym(args.favorite, true)
    if (f) {
      primary = f.slot
      safety = f.verdict
    }
  }

  if (!primary && args.backup) {
    const b = tryGym(args.backup, false)
    if (b) {
      primary = b.slot
      safety = b.verdict
    }
  }

  if (!primary) {
    const w = tryWalk()
    if (w) {
      primary = w.slot
      safety = w.verdict
    }
  }

  if (primary?.activity === 'salle' && args.backup && primary.gymId !== args.backup.id) {
    const b = tryGym(args.backup, false)
    if (b) planB = b.slot
  }

  return { primary, planB, safety, banners: [...new Set([...banners, ...safety.lines])] }
}

export function formatDelayMessage(
  newSessionHm: CreneauHm,
  newReturnHm: CreneauHm,
): string {
  return `${CRENEAU_PHRASES.delayOkPrefix} ${newSessionHm}, retour vers ${newReturnHm}.`
}

export type CrowdReport = {
  gymId: string
  level: CreneauCrowdLevel
  atMs: number
}

export type CrowdSummary = {
  level: CreneauCrowdLevel | null
  confidence: CreneauCrowdConfidence
  label: string
  confidenceLabel: string
  sampleCount: number
}

/** Affluence from user check-in taps only (no Google / paid APIs). */
export function summarizeCrowd(
  reports: CrowdReport[],
  gymId: string,
  nowMs: number,
): CrowdSummary {
  const live = reports.filter(
    (r) =>
      r.gymId === gymId &&
      nowMs - r.atMs <= CRENEAU_CROWD_LIVE_TTL_MS &&
      nowMs >= r.atMs,
  )
  if (live.length === 0) {
    return {
      level: null,
      confidence: 'on_apprend',
      label: CRENEAU_CONFIDENCE_LABEL.on_apprend,
      confidenceLabel: CRENEAU_CONFIDENCE_LABEL.on_apprend,
      sampleCount: 0,
    }
  }
  const counts: Record<CreneauCrowdLevel, number> = { calme: 0, moyen: 0, charge: 0 }
  for (const r of live) counts[r.level] += 1
  let best: CreneauCrowdLevel = 'moyen'
  let bestN = -1
  for (const k of ['calme', 'moyen', 'charge'] as CreneauCrowdLevel[]) {
    if (counts[k] > bestN) {
      best = k
      bestN = counts[k]
    }
  }
  const confidence: CreneauCrowdConfidence =
    live.length >= CRENEAU_CROWD_SURE_MIN && bestN >= Math.ceil(live.length * 0.6)
      ? 'sur'
      : 'a_confirmer'
  return {
    level: best,
    confidence,
    label: CRENEAU_CROWD_LABEL[best],
    confidenceLabel: CRENEAU_CONFIDENCE_LABEL[confidence],
    sampleCount: live.length,
  }
}

export function activationPhrase(
  kind: 'evening_walk' | 'staffless',
): string {
  return kind === 'evening_walk'
    ? CRENEAU_PHRASES.eveningWalkActivate
    : CRENEAU_PHRASES.stafflessActivate
}
