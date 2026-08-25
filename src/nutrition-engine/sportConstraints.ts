import type { MacroFloorsAndTargets, NutritionGoal } from './types.ts'

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
  'cyclisme',
  'endurance',
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

export function hasAnySport(
  sportPrincipal: string | null,
  sportSecondaire: string | null,
): boolean {
  return Boolean(sportPrincipal?.trim() || sportSecondaire?.trim())
}

/**
 * Prot_Target — spec production :
 * PERTE + musculation → 2.4 ; au moins un sport → 1.6 ; sinon → 0.8.
 */
export function resolveProteinTargetGPerKg(
  flags: SportFlags,
  goal: NutritionGoal,
  sportPresent: boolean,
): number {
  if (flags.hasMusculation && goal === 'cut') return 2.4
  if (sportPresent) return 1.6
  return 0.8
}

export function resolveMacroConstraints(
  weightKg: number,
  flags: SportFlags,
  goal: NutritionGoal,
  targetKcal: number,
  sportPrincipal: string | null = null,
  sportSecondaire: string | null = null,
): MacroFloorsAndTargets {
  const protMinGPerKg = resolveProteinMinGPerKg(flags, goal)
  const sportPresent = hasAnySport(sportPrincipal, sportSecondaire)
  const protTargetGPerKg = resolveProteinTargetGPerKg(flags, goal, sportPresent)

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
