import type { MacroFloorsAndTargets, NutritionGoal } from './types'

export interface SportFlags {
  hasMusculation: boolean
  hasCollectif: boolean
  hasEndurance: boolean
}

const MUSCULATION_IDS = new Set([
  'musculation',
  'bodybuilding',
  'crossfit',
  'powerlifting',
  'halterophilie',
  'calisthenics',
  'functional',
])

const COLLECTIF_IDS = new Set([
  'football',
  'basketball',
  'rugby',
  'handball',
  'volleyball',
  'futsal',
  'hockey',
  'baseball',
  'cricket',
  'american-football',
  'netball',
  'ultimate',
  'waterpolo',
])

const ENDURANCE_IDS = new Set([
  'course-a-pied',
  'marche',
  'velo',
  'vtt',
  'spinning',
  'triathlon',
  'trail',
  'cardio-salle',
  'elliptique',
  'rameur',
  'stairmaster',
  'corde-a-sauter',
  'roller',
  'ski-fond',
  'aviron',
  'natation',
])

function classifySportId(sportId: string): SportFlags {
  const id = sportId.trim().toLowerCase()
  return {
    hasMusculation: MUSCULATION_IDS.has(id),
    hasCollectif: COLLECTIF_IDS.has(id),
    hasEndurance: ENDURANCE_IDS.has(id),
  }
}

export function resolveSportFlags(
  sportPrincipal: string | null,
  sportSecondaire: string | null,
): SportFlags {
  const merged: SportFlags = {
    hasMusculation: false,
    hasCollectif: false,
    hasEndurance: false,
  }

  for (const raw of [sportPrincipal, sportSecondaire]) {
    if (!raw) continue
    const flags = classifySportId(raw)
    merged.hasMusculation ||= flags.hasMusculation
    merged.hasCollectif ||= flags.hasCollectif
    merged.hasEndurance ||= flags.hasEndurance
  }

  return merged
}

/** g/kg — cascade de priorité (pas de double comptage). */
export function resolveProteinMinGPerKg(flags: SportFlags, goal: NutritionGoal): number {
  if (flags.hasMusculation && goal === 'cut') return 2.4
  if (flags.hasMusculation || flags.hasCollectif) return 1.4
  if (flags.hasEndurance) return 1.2
  return 0.8
}

/**
 * Prot_Target — spec validée : aucune valeur numérique fournie hors Prot_Min.
 * Voir docs/PROT_TARGET_DECISION.md. Prot_Target := Prot_Min (pas d’invention).
 */
export function resolveProteinTargetGPerKg(protMinGPerKg: number): number {
  return protMinGPerKg
}

export function resolveMacroConstraints(
  weightKg: number,
  flags: SportFlags,
  goal: NutritionGoal,
  targetKcal: number,
): MacroFloorsAndTargets {
  const protMinGPerKg = resolveProteinMinGPerKg(flags, goal)
  const protTargetGPerKg = resolveProteinTargetGPerKg(protMinGPerKg)

  const protMinG = protMinGPerKg * weightKg
  const protTargetG = protTargetGPerKg * weightKg

  const lipMinG = 0.5 * weightKg
  const lipTargetFromPctG = (targetKcal * 0.25) / 9
  const lipTargetG = Math.max(lipMinG, lipTargetFromPctG)

  const glucMinG = flags.hasEndurance ? 6 * weightKg : 0
  const glucTargetG = flags.hasEndurance ? 8 * weightKg : 0

  return {
    prot_min_g: protMinG,
    prot_target_g: protTargetG,
    lip_min_g: lipMinG,
    lip_target_g: lipTargetG,
    gluc_min_g: glucMinG,
    gluc_target_g: glucTargetG,
  }
}
