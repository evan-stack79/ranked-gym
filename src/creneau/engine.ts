/**
 * Mon créneau — pure safety + slot helpers (SCIENCE_42, 10× choix A, UX_20).
 * No Convex. No Google. No medical / score / kcal copy.
 *
 * B1: absolute day-minutes (never modulo for comparisons across midnight).
 * B2: sunset from city coords (see sunset.ts), never a manual checkbox.
 */

import {
  CRENEAU_ADULT_WALK_CURFEW_HM,
  CRENEAU_ASSUME_STAFFLESS_AFTER_HM,
  CRENEAU_CROWD_LIVE_TTL_MS,
  CRENEAU_CROWD_SURE_MIN,
  CRENEAU_DEFAULT_LOCKER_MIN,
  CRENEAU_DEFAULT_SESSION_MIN,
  CRENEAU_MINOR_EARLIEST_HM,
  CRENEAU_MINOR_HOME_BEFORE_HM,
  CRENEAU_PHRASES,
  type CreneauCrowdConfidence,
  type CreneauCrowdLevel,
  CRENEAU_CROWD_LABEL,
  CRENEAU_CONFIDENCE_LABEL,
} from './constants'
import {
  computeSunTimes,
  formatSoleilSeCouchePhrase,
  isAfterSunsetHm,
  PARIS_COORDS,
} from './sunset'

export type CreneauActivity = 'salle' | 'marche'

export type CreneauHm = string // HH:MM

/** Minutes since local day-0 00:00 (may exceed 1440 when crossing midnight). */
export type AbsMin = number

export function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim())
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

/** Clock face HH:MM from absolute minutes (wraps display only). */
export function formatHm(totalMin: number): CreneauHm {
  const n = ((Math.round(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(n / 60)
  const m = n % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Add delta to a clock HM → absolute minutes from the departure day.
 * Cross-midnight returns values ≥ 1440 (B1 — never lose the day).
 */
export function addMinutesAbs(hm: CreneauHm, deltaMin: number): AbsMin | null {
  const base = parseHm(hm)
  if (base == null) return null
  return base + deltaMin
}

/** Legacy clock-wrap helper (display). Prefer addMinutesAbs for safety. */
export function addMinutes(hm: CreneauHm, deltaMin: number): CreneauHm | null {
  const abs = addMinutesAbs(hm, deltaMin)
  if (abs == null) return null
  return formatHm(abs)
}

export function crossesMidnight(startAbs: AbsMin, endAbs: AbsMin): boolean {
  return endAbs >= 1440 || Math.floor(startAbs / 1440) !== Math.floor(endAbs / 1440)
}

/** Mineur 15–17 (app min 15). Age inconnu → mode protecteur mineur. */
export function isCreneauMinor(age: number | null | undefined): boolean {
  if (age == null || !Number.isFinite(age)) return true
  return age < 18
}

export type SlotSafetyInput = {
  age: number | null
  activity: CreneauActivity
  /** Départ (maison ou travail) — clock HM of day 0. */
  departureHm: CreneauHm
  /** Arrivée à la maison — absolute minutes from day-0 00:00 (B1). */
  returnHomeAbs: AbsMin
  /** Absolute departure minutes. */
  departureAbs: AbsMin
  /** Session window absolute (for staffed / closes). */
  sessionStartAbs: AbsMin
  sessionEndAbs: AbsMin
  lockerAfterAbs: AbsMin
  /** Trajet / séance after sunset (computed, never manual). */
  afterSunset: boolean
  heatVigilance: boolean
  /** Salle staffed for the full session+locker window. */
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
  lines: string[]
}

/**
 * Safety gate — profile + VETO before crowd.
 * B1: comparisons use absolute minutes (cross-midnight = next day).
 */
export function evaluateSlotSafety(input: SlotSafetyInput): SlotSafetyVerdict {
  const minor = isCreneauMinor(input.age)
  const reasons: string[] = []
  const lines: string[] = []
  const homeLimit = parseHm(CRENEAU_MINOR_HOME_BEFORE_HM)!
  const walkCurfew = parseHm(CRENEAU_ADULT_WALK_CURFEW_HM)!
  const earliest = parseHm(CRENEAU_MINOR_EARLIEST_HM)!

  if (
    input.departureAbs == null ||
    !Number.isFinite(input.departureAbs) ||
    !Number.isFinite(input.returnHomeAbs)
  ) {
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
    const depClock = input.departureAbs % 1440
    // Départ avant 06:00 (même jour) ou créneau qui passe minuit
    if (depClock < earliest || crossesMidnight(input.departureAbs, input.returnHomeAbs)) {
      reasons.push('mineur_hors_fenetre')
    }
    // Retour ≥ 20:00 same day OR any absolute ≥ 20:00 on day 0 spill / next day
    if (input.returnHomeAbs >= homeLimit) {
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

  // Adult
  if (input.activity === 'marche') {
    if (input.throughPark && input.afterSunset) {
      reasons.push('parc_soir')
      lines.push(CRENEAU_PHRASES.parkEvening)
    }
    const depClock = ((input.departureAbs % 1440) + 1440) % 1440
    const retClock = ((input.returnHomeAbs % 1440) + 1440) % 1440
    if (
      depClock >= walkCurfew ||
      retClock >= walkCurfew ||
      crossesMidnight(input.departureAbs, input.returnHomeAbs) ||
      input.returnHomeAbs >= walkCurfew
    ) {
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

/**
 * Staffed for the whole session + post-locker (M2 / B1).
 * After midnight without explicit overnight staff hours → unstaffed.
 */
export function isStaffedForSession(args: {
  sessionStartAbs: AbsMin
  lockerAfterAbs: AbsMin
  staffFromHm: string | null
  staffUntilHm: string | null
}): boolean {
  const { sessionStartAbs, lockerAfterAbs, staffFromHm, staffUntilHm } = args
  // Cross midnight → assume unstaffed unless staffUntil explicitly > 24h (not supported)
  if (crossesMidnight(sessionStartAbs, lockerAfterAbs)) {
    return false
  }
  const startClock = sessionStartAbs % 1440
  const endClock = lockerAfterAbs % 1440
  const from = staffFromHm ? parseHm(staffFromHm) : parseHm('06:00')
  const until = staffUntilHm
    ? parseHm(staffUntilHm)
    : parseHm(CRENEAU_ASSUME_STAFFLESS_AFTER_HM)
  if (from == null || until == null) return false
  return startClock >= from && endClock <= until
}

/** @deprecated prefer isStaffedForSession — kept for call-site greps. */
export function assumeStaffedAt(
  sessionHm: CreneauHm,
  staffUntilHm: CreneauHm | null,
): boolean {
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
  departureAbs: AbsMin
  sessionStartAbs: AbsMin
  sessionEndAbs: AbsMin
  returnAbs: AbsMin
  soft: boolean
  staffed: boolean
  travelMin: number
  trajetLabel: string
}

export type GymPropose = {
  id: string
  name: string
  staffFromHm: string | null
  staffUntilHm: string | null
  closesHm: string | null
  travelMin: number
  latitude?: number
  longitude?: number
  cityKnown?: boolean
}

export type ProposeArgs = {
  age: number | null
  nowHm: CreneauHm
  /** When omitted, computed from gym city coords + date. */
  afterSunset?: boolean
  sunsetDisplayHm?: string
  sunriseHm?: string
  heatVigilance: boolean
  eveningWalkEnabled: boolean
  stafflessGymEnabled: boolean
  preferQuiet: boolean
  softSession: boolean
  delayMin: number
  favorite: GymPropose | null
  backup: GymPropose | null
  lockerMin?: number
  sessionMin?: number
  preferWalk?: boolean
  trajetMode?: 'pied' | 'velo' | 'transports' | 'voiture'
  nowDate?: Date
}

function trajetLabel(mode: ProposeArgs['trajetMode'], travelMin: number): string {
  const m =
    mode === 'velo'
      ? 'à vélo'
      : mode === 'transports'
        ? 'en transports'
        : mode === 'voiture'
          ? 'en voiture'
          : 'à pied'
  return `${travelMin} min ${m}`
}

function windowAfterSunset(
  departureAbs: AbsMin,
  returnAbs: AbsMin,
  sunsetHm: string,
  sunriseHm: string,
): boolean {
  // Sample departure, mid, return clock faces (protecteur: any night → true)
  const samples = [
    departureAbs,
    Math.floor((departureAbs + returnAbs) / 2),
    returnAbs,
  ]
  return samples.some((abs) =>
    isAfterSunsetHm(formatHm(abs), sunsetHm, sunriseHm),
  )
}

/**
 * Build one primary slot (+ optional plan B gym) respecting safety.
 */
export function proposeCreneau(args: ProposeArgs): {
  primary: ProposedSlot | null
  planB: ProposedSlot | null
  safety: SlotSafetyVerdict
  banners: string[]
  sunsetDisplayHm: string | null
  soleilPhrase: string | null
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

  const date = args.nowDate ?? new Date()
  const gymForSun = args.favorite ?? args.backup
  const lat = gymForSun?.latitude ?? PARIS_COORDS.latitude
  const lng = gymForSun?.longitude ?? PARIS_COORDS.longitude
  const cityKnown = gymForSun?.cityKnown !== false && gymForSun != null
  const sun = computeSunTimes(date, lat, lng)
  const sunsetDisplayHm = args.sunsetDisplayHm ?? sun.sunsetDisplayHm
  const sunriseHm = args.sunriseHm ?? sun.sunriseHm
  const soleilPhrase = formatSoleilSeCouchePhrase(sunsetDisplayHm)

  const tryGym = (
    gym: GymPropose,
    favorite: boolean,
  ): { slot: ProposedSlot; verdict: SlotSafetyVerdict } | null => {
    const travel = gym.travelMin
    const departureAbs = addMinutesAbs(args.nowHm, Math.max(0, args.delayMin))!
    const sessionStartAbs = departureAbs + travel + locker
    const sessionEndAbs = sessionStartAbs + sessionMin
    const lockerAfterAbs = sessionEndAbs + locker
    const returnAbs = lockerAfterAbs + travel

    // Closes: refuse if session+locker past closes
    if (gym.closesHm) {
      const closes = parseHm(gym.closesHm)
      if (closes != null && lockerAfterAbs % 1440 > closes && lockerAfterAbs < 1440) {
        return null
      }
      if (lockerAfterAbs >= 1440) return null
    }

    const staffed = isStaffedForSession({
      sessionStartAbs,
      lockerAfterAbs,
      staffFromHm: gym.staffFromHm,
      staffUntilHm: gym.staffUntilHm,
    })

    const afterSunset =
      args.afterSunset ??
      windowAfterSunset(departureAbs, returnAbs, sunsetDisplayHm, sunriseHm)

    const departureHm = formatHm(departureAbs)
    const verdict = evaluateSlotSafety({
      age: args.age,
      activity: 'salle',
      departureHm,
      departureAbs,
      returnHomeAbs: returnAbs,
      sessionStartAbs,
      sessionEndAbs,
      lockerAfterAbs,
      afterSunset,
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
        sessionStartHm: formatHm(sessionStartAbs),
        sessionEndHm: formatHm(sessionEndAbs),
        returnHm: formatHm(returnAbs),
        departureAbs,
        sessionStartAbs,
        sessionEndAbs,
        returnAbs,
        soft: args.softSession,
        staffed,
        travelMin: travel,
        trajetLabel: trajetLabel(args.trajetMode, travel),
      },
      verdict,
    }
  }

  const tryWalk = (): { slot: ProposedSlot; verdict: SlotSafetyVerdict } | null => {
    if (args.heatVigilance) return null
    // Sans ville connue → pas de marche mise en avant (B2 / C33)
    if (!cityKnown && args.afterSunset == null) return null
    const travel = 15
    const departureAbs = addMinutesAbs(args.nowHm, Math.max(0, args.delayMin))!
    const sessionStartAbs = departureAbs + 5
    const sessionEndAbs = sessionStartAbs + (args.softSession ? 20 : 40)
    const returnAbs = sessionEndAbs + travel
    const afterSunset =
      args.afterSunset ??
      windowAfterSunset(departureAbs, returnAbs, sunsetDisplayHm, sunriseHm)
    const departureHm = formatHm(departureAbs)
    const verdict = evaluateSlotSafety({
      age: args.age,
      activity: 'marche',
      departureHm,
      departureAbs,
      returnHomeAbs: returnAbs,
      sessionStartAbs,
      sessionEndAbs,
      lockerAfterAbs: sessionEndAbs,
      afterSunset,
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
        sessionStartHm: formatHm(sessionStartAbs),
        sessionEndHm: formatHm(sessionEndAbs),
        returnHm: formatHm(returnAbs),
        departureAbs,
        sessionStartAbs,
        sessionEndAbs,
        returnAbs,
        soft: args.softSession,
        staffed: true,
        travelMin: travel,
        trajetLabel: trajetLabel('pied', travel),
      },
      verdict,
    }
  }

  let primary: ProposedSlot | null = null
  let safety: SlotSafetyVerdict = { allowed: false, reasons: ['aucun_creneau'], lines: banners }
  let planB: ProposedSlot | null = null

  const afterNow =
    args.afterSunset ??
    isAfterSunsetHm(args.nowHm, sunsetDisplayHm, sunriseHm)

  if (args.preferWalk && !afterNow) {
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

  // Soirée / fin de vacation : séance 60 min hors fenêtre staffée → retenter en séance douce
  // (30 min) avant d’afficher l’état vide. Ne change pas les vetos mineurs.
  if (!primary && !args.softSession) {
    return proposeCreneau({ ...args, softSession: true })
  }

  return {
    primary,
    planB,
    safety,
    banners: [...new Set([...banners, ...safety.lines])],
    sunsetDisplayHm,
    soleilPhrase,
  }
}

export function formatDelayMessage(
  newSessionHm: CreneauHm,
  newReturnHm: CreneauHm,
): string {
  return `${CRENEAU_PHRASES.delayOkPrefix} ${newSessionHm}, retour vers ${newReturnHm}.`
}

export function formatDeparturePassed(hm: CreneauHm): string {
  return `${hm} est passé.`
}

export function formatDeparturePassedWithNew(hm: CreneauHm): string {
  return `${hm} est passé. Nouvelle heure :`
}

export type CrowdReport = {
  gymId: string
  level: CreneauCrowdLevel
  atMs: number
  /** Stable person id — required to dedupe (CA-C22). */
  personId?: string
}

export type CrowdSummary = {
  level: CreneauCrowdLevel | null
  confidence: CreneauCrowdConfidence
  label: string
  confidenceLabel: string
  sampleCount: number
  uniquePeople: number
}

/**
 * Affluence from user check-in taps only.
 * Dedupe by personId: 3 taps from the same person ≠ « sûr » (CA-C22).
 */
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
  // Keep latest report per person (missing personId → each tap is unique anon slot, but
  // local self-taps share the same personId from storage).
  const byPerson = new Map<string, CrowdReport>()
  let anonSeq = 0
  for (const r of live) {
    const key = r.personId?.trim() || `__anon_${anonSeq++}`
    const prev = byPerson.get(key)
    if (!prev || r.atMs >= prev.atMs) byPerson.set(key, r)
  }
  const unique = [...byPerson.values()]
  if (unique.length === 0) {
    return {
      level: null,
      confidence: 'on_apprend',
      label: CRENEAU_CONFIDENCE_LABEL.on_apprend,
      confidenceLabel: CRENEAU_CONFIDENCE_LABEL.on_apprend,
      sampleCount: 0,
      uniquePeople: 0,
    }
  }
  const counts: Record<CreneauCrowdLevel, number> = { calme: 0, moyen: 0, charge: 0 }
  for (const r of unique) counts[r.level] += 1
  let best: CreneauCrowdLevel = 'moyen'
  let bestN = -1
  for (const k of ['calme', 'moyen', 'charge'] as CreneauCrowdLevel[]) {
    if (counts[k] > bestN) {
      best = k
      bestN = counts[k]
    }
  }
  // « sûr » only with ≥ CRENEAU_CROWD_SURE_MIN distinct people agreeing
  const confidence: CreneauCrowdConfidence =
    unique.length >= CRENEAU_CROWD_SURE_MIN && bestN >= Math.ceil(unique.length * 0.6)
      ? 'sur'
      : unique.length >= 1
        ? 'a_confirmer'
        : 'on_apprend'
  return {
    level: best,
    confidence,
    label: CRENEAU_CROWD_LABEL[best],
    confidenceLabel: CRENEAU_CONFIDENCE_LABEL[confidence],
    sampleCount: unique.length,
    uniquePeople: unique.length,
  }
}

export function activationPhrase(
  kind: 'evening_walk' | 'staffless',
): string {
  return kind === 'evening_walk'
    ? CRENEAU_PHRASES.eveningWalkActivate
    : CRENEAU_PHRASES.stafflessActivate
}

export { formatSoleilSeCouchePhrase, computeSunTimes }
