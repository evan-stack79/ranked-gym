/**
 * Adaptateur Accueil — Sleep Storage → Sleep Engine (pur) → vue produit.
 * N’invente aucune nuit ni aucun TST ; n’ajoute aucun Sleep Score médical.
 */

import {
  computeRegularityMetrics,
  computeTibHours,
  minutesOfDay,
  parseTimeToMinutes,
  runSleepEngine,
  type SleepEngineSuccess,
  type SleepQuantityStatus,
} from '../sleep-engine'
import {
  getLatestSleepNight,
  getRecentSleepNights,
  type SleepNightEntry,
} from './sleepStorage'

const HISTORY_WINDOW = 7

export interface SleepHomeViewModel {
  hasData: boolean
  latest: SleepNightEntry | null
  engine: SleepEngineSuccess | null
  /** false si l’utilisateur a choisi « Je ne sais pas » (ou pas de HealthKit). */
  tstKnown: boolean
  tstHours: number | null
  tstLabel: string | null
  tibHours: number | null
  tibLabel: string | null
  statusKey: SleepQuantityStatus | null
  statusLabel: string | null
  tonightBedtimeHm: string | null
  tonightBedtimeLabel: string | null
  tonightHint: string | null
  insufficientHistory: boolean
  recommendations: string[]
  warnings: string[]
}

export function formatTstHoursLabel(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function formatBedtimeLabel(hm: string): string {
  const [hRaw, mRaw] = hm.split(':')
  const h = Number(hRaw)
  const m = Number(mRaw)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hm
  if (m === 0) return `${h} h`
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function quantityStatusLabel(status: SleepQuantityStatus): string {
  switch (status) {
    case 'optimal':
      return 'Récupération optimale'
    case 'deficit':
      return 'Sommeil insuffisant'
    case 'excess':
      return 'Au-dessus de la plage recommandée'
  }
}

/** Moyenne circulaire des heures HH:MM → HH:MM, ou null si < 1 échantillon. */
export function circularMeanBedtimeHm(times: string[]): string | null {
  const samples = times
    .map((t) => parseTimeToMinutes(t))
    .filter((n): n is number => n != null)
  if (samples.length === 0) return null

  const angles = samples.map((m) => (minutesOfDay(m) / (24 * 60)) * 2 * Math.PI)
  const meanSin = angles.reduce((s, a) => s + Math.sin(a), 0) / angles.length
  const meanCos = angles.reduce((s, a) => s + Math.cos(a), 0) / angles.length
  let meanAngle = Math.atan2(meanSin, meanCos)
  if (meanAngle < 0) meanAngle += 2 * Math.PI
  const meanMinutes = Math.round((meanAngle / (2 * Math.PI)) * 24 * 60) % (24 * 60)
  const h = Math.floor(meanMinutes / 60)
  const m = meanMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function suggestTonightBedtimeFromHistory(
  nights: SleepNightEntry[],
  engine: SleepEngineSuccess | null,
): string | null {
  const bedtimes = nights.map((n) => n.bedtime)
  const mean = circularMeanBedtimeHm(bedtimes)
  const last = nights[0]?.bedtime ?? null
  const base = mean ?? last
  if (!base) return null

  const shiftEarlier =
    engine != null && (engine.status === 'deficit' || engine.metrics.catchUp.recoveryNeeded)

  if (!shiftEarlier) return base

  const mins = parseTimeToMinutes(base)
  if (mins == null) return base
  const shifted = minutesOfDay(mins - 30)
  const h = Math.floor(shifted / 60)
  const m = Math.round(shifted % 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function tonightHintFor(
  bedtimeHm: string | null,
  engine: SleepEngineSuccess | null,
): string | null {
  if (!bedtimeHm) return null
  const label = formatBedtimeLabel(bedtimeHm)
  if (!engine) {
    return `Couche-toi vers ${label} pour maintenir ton rythme.`
  }
  if (engine.metrics.catchUp.recoveryNeeded || engine.status === 'deficit') {
    return `Couche-toi vers ${label} pour récupérer tout en gardant un rythme stable.`
  }
  if (engine.status === 'excess') {
    return `Couche-toi vers ${label} pour maintenir un rythme régulier.`
  }
  return `Couche-toi vers ${label} pour maintenir ton rythme.`
}

/**
 * Construit la vue Accueil à partir du stockage local + moteur existant.
 * Sans nuit → hasData false. Sans TST → pas de faux nombre d’heures dormies.
 */
export function getSleepHomeSnapshot(): SleepHomeViewModel {
  const empty: SleepHomeViewModel = {
    hasData: false,
    latest: null,
    engine: null,
    tstKnown: false,
    tstHours: null,
    tstLabel: null,
    tibHours: null,
    tibLabel: null,
    statusKey: null,
    statusLabel: null,
    tonightBedtimeHm: null,
    tonightBedtimeLabel: null,
    tonightHint: null,
    insufficientHistory: true,
    recommendations: [],
    warnings: [],
  }

  const latest = getLatestSleepNight()
  if (!latest) return empty

  const recent = getRecentSleepNights(HISTORY_WINDOW)
  const older = recent.slice(1)
  const tibHours = computeTibHours(latest.bedtime, latest.waketime)
  const tibLabel = tibHours != null && tibHours > 0 ? formatTstHoursLabel(tibHours) : null

  // TST inconnu : on n’appelle pas le moteur quantité (pas de faux TST = TIB).
  if (latest.tstHours == null) {
    const regularity = computeRegularityMetrics(
      latest.bedtime,
      latest.waketime,
      older.map((n) => n.bedtime),
      older.map((n) => n.waketime),
    )
    const tonightHm = suggestTonightBedtimeFromHistory(recent, null)
    return {
      hasData: true,
      latest,
      engine: null,
      tstKnown: false,
      tstHours: null,
      tstLabel: null,
      tibHours,
      tibLabel,
      statusKey: null,
      statusLabel: null,
      tonightBedtimeHm: tonightHm,
      tonightBedtimeLabel: tonightHm ? formatBedtimeLabel(tonightHm) : null,
      tonightHint: tonightHintFor(tonightHm, null),
      insufficientHistory: regularity.insufficientHistory,
      recommendations: [
        'Temps réellement dormi inconnu — le temps au lit seul ne permet pas d’évaluer la quantité de sommeil.',
      ],
      warnings: [],
    }
  }

  const knownTstNights = recent.filter((n): n is SleepNightEntry & { tstHours: number } => n.tstHours != null)

  const result = runSleepEngine({
    bedtime: latest.bedtime,
    waketime: latest.waketime,
    tstHours: latest.tstHours,
    historicalBedtimes: older.map((n) => n.bedtime),
    historicalWaketimes: older.map((n) => n.waketime),
    workdayTstHours: knownTstNights.map((n) => n.tstHours),
    currentTibHours: tibHours ?? undefined,
  })

  if (!result.ok) {
    return {
      ...empty,
      hasData: true,
      latest,
      tstKnown: true,
      tstHours: latest.tstHours,
      tstLabel: formatTstHoursLabel(latest.tstHours),
      tibHours,
      tibLabel,
      recommendations: [],
      warnings: [result.message],
    }
  }

  const tonightHm = suggestTonightBedtimeFromHistory(recent, result)

  return {
    hasData: true,
    latest,
    engine: result,
    tstKnown: true,
    tstHours: result.metrics.quantity.tstHours,
    tstLabel: formatTstHoursLabel(result.metrics.quantity.tstHours),
    tibHours,
    tibLabel,
    statusKey: result.status,
    statusLabel: quantityStatusLabel(result.status),
    tonightBedtimeHm: tonightHm,
    tonightBedtimeLabel: tonightHm ? formatBedtimeLabel(tonightHm) : null,
    tonightHint: tonightHintFor(tonightHm, result),
    insufficientHistory: result.metrics.regularity.insufficientHistory,
    recommendations: result.recommendations,
    warnings: result.warnings,
  }
}
