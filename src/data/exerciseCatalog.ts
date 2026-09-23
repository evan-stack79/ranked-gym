/**
 * Bibliothèque locale d’exercices.
 * Source de vérité : noms, muscles, équipement, alias, sport, mouvement, niveau, effort.
 * Les assets visuels restent câblés via `canonicalExerciseId` → `exerciseMedia`.
 */

export type ExerciseEquipment =
  | 'Barre'
  | 'Haltères'
  | 'Machine'
  | 'Poids du corps'
  | 'Câble'
  | 'Kettlebell'
  | 'Autre'

export type ExerciseMovement = 'push' | 'pull' | 'legs' | 'core'

export type ExerciseEffortType = 'strength' | 'hypertrophy' | 'endurance'

export type ExerciseLevel = 'beginner' | 'intermediate' | 'advanced'

export type CatalogExercise = {
  /** Identifiant canonique stable (ex. bench_press). */
  id: string
  /** Nom affiché FR. */
  name: string
  /** Muscles principaux. */
  muscles: string[]
  /** Équipement principal. */
  equipment: ExerciseEquipment
  /** Alias de recherche (EN / abréviations / fautes courantes). */
  aliases: string[]
  /** Popularité pour le tri par défaut (plus haut = plus visible). */
  popularity: number
  /** Sports du catalogue `SPORTS` auxquels cet exercice appartient. */
  sportIds: string[]
  /** Famille de mouvement (jamais déduite du nom libre). */
  movement: ExerciseMovement
  /** Type d’effort canonique. */
  effortType: ExerciseEffortType
  /** Niveau technique déclaré. */
  level: ExerciseLevel
}

const CATALOG_SEED: Omit<CatalogExercise, 'movement' | 'effortType' | 'level' | 'sportIds'>[] = [
  // —— Poussée / pecs ——
  {
    id: 'bench_press',
    name: 'Développé couché',
    muscles: ['Pectoraux', 'Triceps', 'Épaules'],
    equipment: 'Barre',
    aliases: ['bench', 'bench press', 'dc', 'dev couche', 'developpe couche', 'pectoraux barre', 'pec'],
    popularity: 100,
  },
  {
    id: 'incline_bench_press',
    name: 'Développé incliné',
    muscles: ['Pectoraux', 'Triceps', 'Épaules'],
    equipment: 'Barre',
    aliases: ['incline bench', 'dev incline', 'developpe incline', 'incliné'],
    popularity: 96,
  },
  {
    id: 'overhead_press',
    name: 'Développé militaire',
    muscles: ['Épaules', 'Triceps'],
    equipment: 'Barre',
    aliases: ['ohp', 'military press', 'shoulder press', 'dev militaire', 'développé épaules'],
    popularity: 94,
  },
  {
    id: 'dumbbell_bench_press',
    name: 'Développé couché haltères',
    muscles: ['Pectoraux', 'Triceps', 'Épaules'],
    equipment: 'Haltères',
    aliases: ['db bench', 'dumbbell bench', 'dev couche halteres', 'développé haltères'],
    popularity: 93,
  },
  {
    id: 'dumbbell_incline_press',
    name: 'Développé incliné haltères',
    muscles: ['Pectoraux', 'Épaules', 'Triceps'],
    equipment: 'Haltères',
    aliases: ['db incline', 'incline dumbbell press'],
    popularity: 88,
  },
  {
    id: 'dumbbell_fly',
    name: 'Écarté couché',
    muscles: ['Pectoraux'],
    equipment: 'Haltères',
    aliases: ['fly', 'flies', 'pec fly', 'ecarte'],
    popularity: 78,
  },
  {
    id: 'cable_crossover',
    name: 'Écarté poulie',
    muscles: ['Pectoraux'],
    equipment: 'Câble',
    aliases: ['crossover', 'cable fly', 'pec deck'],
    popularity: 72,
  },
  {
    id: 'push_up',
    name: 'Pompe',
    muscles: ['Pectoraux', 'Triceps', 'Épaules'],
    equipment: 'Poids du corps',
    aliases: ['push up', 'pushup', 'pompes'],
    popularity: 80,
  },
  {
    id: 'dip',
    name: 'Dips',
    muscles: ['Pectoraux', 'Triceps'],
    equipment: 'Poids du corps',
    aliases: ['dip', 'bar dips'],
    popularity: 82,
  },

  // —— Dos ——
  {
    id: 'barbell_row',
    name: 'Rowing barre',
    muscles: ['Dos', 'Biceps'],
    equipment: 'Barre',
    aliases: ['bent over row', 'rowing', 'row barre'],
    popularity: 92,
  },
  {
    id: 'lat_pulldown',
    name: 'Tirage vertical',
    muscles: ['Dos', 'Biceps'],
    equipment: 'Câble',
    aliases: ['lat pulldown', 'pull down', 'tirage poulie haute', 'tirage dos', 'tirage'],
    popularity: 90,
  },
  {
    id: 'pull_up',
    name: 'Traction',
    muscles: ['Dos', 'Biceps'],
    equipment: 'Poids du corps',
    aliases: ['pull up', 'pullup', 'chin up', 'tractions'],
    popularity: 91,
  },
  {
    id: 'seated_cable_row',
    name: 'Rowing poulie',
    muscles: ['Dos', 'Biceps'],
    equipment: 'Câble',
    aliases: ['seated row', 'cable row'],
    popularity: 86,
  },
  {
    id: 'deadlift',
    name: 'Soulevé de terre',
    muscles: ['Dos', 'Ischios', 'Fessiers'],
    equipment: 'Barre',
    aliases: ['deadlift', 'sdt', 'souleve de terre'],
    popularity: 98,
  },

  // —— Jambes ——
  {
    id: 'back_squat',
    name: 'Squat',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Barre',
    aliases: ['squat', 'back squat', 'squat barre'],
    popularity: 99,
  },
  {
    id: 'front_squat',
    name: 'Squat avant',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Barre',
    aliases: ['front squat'],
    popularity: 75,
  },
  {
    id: 'leg_press',
    name: 'Presse à cuisses',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Machine',
    aliases: ['leg press', 'presse cuisses', 'presse a cuisses', 'jambes machine', 'jambes'],
    popularity: 89,
  },
  {
    id: 'romanian_deadlift',
    name: 'Soulevé de terre roumain',
    muscles: ['Ischios', 'Fessiers'],
    equipment: 'Barre',
    aliases: ['rdl', 'romanian deadlift', 'souleve roumain'],
    popularity: 85,
  },
  {
    id: 'leg_curl',
    name: 'Curl ischio',
    muscles: ['Ischios'],
    equipment: 'Machine',
    aliases: ['leg curl', 'hamstring curl'],
    popularity: 74,
  },
  {
    id: 'leg_extension',
    name: 'Extension de jambes',
    muscles: ['Quadriceps'],
    equipment: 'Machine',
    aliases: ['leg extension', 'quad extension'],
    popularity: 73,
  },
  {
    id: 'walking_lunge',
    name: 'Fentes',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Haltères',
    aliases: ['lunge', 'lunges', 'fente'],
    popularity: 77,
  },
  {
    id: 'hip_thrust',
    name: 'Hip thrust',
    muscles: ['Fessiers'],
    equipment: 'Barre',
    aliases: ['hip thrust', 'bridge', 'pont fessier'],
    popularity: 84,
  },
  {
    id: 'calf_raise',
    name: 'Mollets debout',
    muscles: ['Mollets'],
    equipment: 'Machine',
    aliases: ['calf raise', 'mollets'],
    popularity: 70,
  },

  // —— Épaules / bras ——
  {
    id: 'lateral_raise',
    name: 'Élévations latérales',
    muscles: ['Épaules'],
    equipment: 'Haltères',
    aliases: ['lateral raise', 'side raise', 'elevations laterales'],
    popularity: 81,
  },
  {
    id: 'face_pull',
    name: 'Face pull',
    muscles: ['Épaules', 'Dos'],
    equipment: 'Câble',
    aliases: ['face pull', 'facepull'],
    popularity: 71,
  },
  {
    id: 'barbell_curl',
    name: 'Curl barre',
    muscles: ['Biceps'],
    equipment: 'Barre',
    aliases: ['barbell curl', 'curl', 'biceps curl'],
    popularity: 83,
  },
  {
    id: 'dumbbell_curl',
    name: 'Curl haltères',
    muscles: ['Biceps'],
    equipment: 'Haltères',
    aliases: ['db curl', 'dumbbell curl'],
    popularity: 79,
  },
  {
    id: 'triceps_pushdown',
    name: 'Extension triceps poulie',
    muscles: ['Triceps'],
    equipment: 'Câble',
    aliases: ['pushdown', 'triceps extension', 'cable pushdown'],
    popularity: 80,
  },
  {
    id: 'skull_crusher',
    name: 'Barre au front',
    muscles: ['Triceps'],
    equipment: 'Barre',
    aliases: ['skull crusher', 'lying triceps extension'],
    popularity: 76,
  },
  {
    id: 'plank',
    name: 'Planche',
    muscles: ['Abdos'],
    equipment: 'Poids du corps',
    aliases: ['plank', 'gainage'],
    popularity: 68,
  },
]

const MUSCU = ['musculation', 'bodybuilding', 'functional'] as const
const POWER = ['musculation', 'bodybuilding', 'powerlifting'] as const
const CALI = ['musculation', 'bodybuilding', 'calisthenics'] as const
const CROSS = ['musculation', 'bodybuilding', 'crossfit', 'functional'] as const

type CatalogMeta = Pick<CatalogExercise, 'movement' | 'effortType' | 'level' | 'sportIds'>

const CATALOG_META: Record<string, CatalogMeta> = {
  bench_press: { movement: 'push', effortType: 'strength', level: 'intermediate', sportIds: [...POWER] },
  incline_bench_press: { movement: 'push', effortType: 'hypertrophy', level: 'intermediate', sportIds: [...MUSCU] },
  overhead_press: { movement: 'push', effortType: 'strength', level: 'intermediate', sportIds: [...POWER, 'halterophilie'] },
  dumbbell_bench_press: { movement: 'push', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  dumbbell_incline_press: { movement: 'push', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  dumbbell_fly: { movement: 'push', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  cable_crossover: { movement: 'push', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  push_up: { movement: 'push', effortType: 'endurance', level: 'beginner', sportIds: [...CALI, 'crossfit'] },
  dip: { movement: 'push', effortType: 'strength', level: 'intermediate', sportIds: [...CALI, 'crossfit'] },
  barbell_row: { movement: 'pull', effortType: 'strength', level: 'intermediate', sportIds: [...POWER] },
  lat_pulldown: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  pull_up: { movement: 'pull', effortType: 'strength', level: 'intermediate', sportIds: [...CALI, 'crossfit'] },
  seated_cable_row: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  deadlift: { movement: 'pull', effortType: 'strength', level: 'intermediate', sportIds: [...POWER, 'crossfit'] },
  back_squat: { movement: 'legs', effortType: 'strength', level: 'intermediate', sportIds: [...POWER, 'crossfit'] },
  front_squat: { movement: 'legs', effortType: 'strength', level: 'advanced', sportIds: [...POWER, 'halterophilie'] },
  leg_press: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  romanian_deadlift: { movement: 'legs', effortType: 'strength', level: 'intermediate', sportIds: [...MUSCU, 'powerlifting'] },
  leg_curl: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  leg_extension: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  walking_lunge: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU, 'functional'] },
  hip_thrust: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  calf_raise: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  lateral_raise: { movement: 'push', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  face_pull: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  barbell_curl: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  dumbbell_curl: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  triceps_pushdown: { movement: 'push', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  skull_crusher: { movement: 'push', effortType: 'hypertrophy', level: 'intermediate', sportIds: [...MUSCU] },
  plank: { movement: 'core', effortType: 'endurance', level: 'beginner', sportIds: [...CALI, ...CROSS] },
}

export const EXERCISE_CATALOG: CatalogExercise[] = CATALOG_SEED.map((ex) => {
  const extra = CATALOG_META[ex.id]
  if (!extra) {
    throw new Error(`Métadonnées canoniques manquantes pour ${ex.id}`)
  }
  return { ...ex, ...extra, sportIds: [...new Set(extra.sportIds)] }
})

const BY_ID = new Map(EXERCISE_CATALOG.map((ex) => [ex.id, ex]))

export function getCatalogExercise(id: string | null | undefined): CatalogExercise | undefined {
  if (!id) return undefined
  return BY_ID.get(id)
}

/** Ligne métadonnées : `Pectoraux · Triceps · Barre` (2 muscles max + équipement). */
export function formatCatalogMeta(ex: CatalogExercise): string {
  const muscles = ex.muscles.filter(Boolean).slice(0, 2).join(' · ')
  if (!muscles) return ex.equipment
  return `${muscles} · ${ex.equipment}`
}
