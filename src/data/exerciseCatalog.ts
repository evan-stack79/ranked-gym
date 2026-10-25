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

  // —— Wave 2 (nouveaux, illustrations 3D) ——
  {
    id: 'goblet_squat',
    name: 'Goblet squat',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Haltères',
    aliases: ['goblet', 'goblet squat', 'squat gobelet'],
    popularity: 82,
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Fente bulgare',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Haltères',
    aliases: ['bulgarian split squat', 'split squat', 'fente arrière', 'fente bulgare'],
    popularity: 81,
  },
  {
    id: 'hammer_curl',
    name: 'Curl marteau',
    muscles: ['Biceps'],
    equipment: 'Haltères',
    aliases: ['hammer curl', 'curl neutre', 'curl marteau'],
    popularity: 78,
  },
  {
    id: 'arnold_press',
    name: 'Développé Arnold',
    muscles: ['Épaules', 'Triceps'],
    equipment: 'Haltères',
    aliases: ['arnold press', 'arnold', 'dev arnold'],
    popularity: 76,
  },
  {
    id: 'hanging_leg_raise',
    name: 'Relevés de jambes',
    muscles: ['Abdos'],
    equipment: 'Poids du corps',
    aliases: ['hanging leg raise', 'leg raise', 'relevé de jambes', 'releves de jambes'],
    popularity: 74,
  },
  {
    id: 'kettlebell_swing',
    name: 'Swing kettlebell',
    muscles: ['Fessiers', 'Dos'],
    equipment: 'Kettlebell',
    aliases: ['kb swing', 'kettlebell swing', 'swing'],
    popularity: 80,
  },
  {
    id: 'chest_supported_row',
    name: 'Rowing appuyé',
    muscles: ['Dos', 'Biceps'],
    equipment: 'Haltères',
    aliases: ['chest supported row', 'incline row', 'rowing banc', 'rowing appuye'],
    popularity: 77,
  },
  {
    id: 'farmer_carry',
    name: 'Farmer walk',
    muscles: ['Dos', 'Mollets'],
    equipment: 'Haltères',
    aliases: ['farmer carry', 'farmers walk', 'marche fermier', 'farmer'],
    popularity: 73,
  },

  // —— Wave 3 (nouveaux, illustrations 3D) ——
  {
    id: 'sumo_deadlift',
    name: 'Soulevé sumo',
    muscles: ['Dos', 'Fessiers'],
    equipment: 'Barre',
    aliases: ['sumo deadlift', 'deadlift sumo', 'souleve sumo', 'sumo'],
    popularity: 84,
  },
  {
    id: 'rear_delt_fly',
    name: 'Oiseau haltères',
    muscles: ['Épaules', 'Dos'],
    equipment: 'Haltères',
    aliases: ['rear delt fly', 'reverse fly', 'oiseau', 'elevations posterieures'],
    popularity: 72,
  },
  {
    id: 'overhead_triceps_extension',
    name: 'Extension triceps nuque',
    muscles: ['Triceps'],
    equipment: 'Haltères',
    aliases: ['overhead extension', 'triceps overhead', 'extension nuque', 'french press'],
    popularity: 75,
  },
  {
    id: 'seated_dumbbell_press',
    name: 'Développé épaules assis',
    muscles: ['Épaules', 'Triceps'],
    equipment: 'Haltères',
    aliases: ['seated shoulder press', 'seated db press', 'dev epaules assis', 'shoulder press assis'],
    popularity: 79,
  },
  {
    id: 'reverse_lunge',
    name: 'Fente arrière',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Haltères',
    aliases: ['reverse lunge', 'backward lunge', 'fente arriere', 'fentes arriere'],
    popularity: 76,
  },
  {
    id: 'chin_up',
    name: 'Traction supination',
    muscles: ['Dos', 'Biceps'],
    equipment: 'Poids du corps',
    aliases: ['chin up', 'chinup', 'traction supination', 'pull up underhand'],
    popularity: 83,
  },
  {
    id: 'concentration_curl',
    name: 'Curl concentration',
    muscles: ['Biceps'],
    equipment: 'Haltères',
    aliases: ['concentration curl', 'curl concentre', 'curl assis'],
    popularity: 70,
  },
  {
    id: 'ab_wheel',
    name: 'Roulette abdos',
    muscles: ['Abdos'],
    equipment: 'Autre',
    aliases: ['ab wheel', 'ab roller', 'roulette', 'wheel rollout'],
    popularity: 71,
  },

  // —— Wave 4 (nouveaux, illustrations 3D) ——
  {
    id: 'good_morning',
    name: 'Good morning',
    muscles: ['Ischios', 'Dos'],
    equipment: 'Barre',
    aliases: ['good morning', 'goodmorning', 'flexion hanches barre'],
    popularity: 69,
  },
  {
    id: 'cable_kickback',
    name: 'Kickback fessier',
    muscles: ['Fessiers'],
    equipment: 'Câble',
    aliases: ['cable kickback', 'glute kickback', 'kickback', 'fessier poulie'],
    popularity: 74,
  },
  {
    id: 'preacher_curl',
    name: 'Curl pupitre',
    muscles: ['Biceps'],
    equipment: 'Barre',
    aliases: ['preacher curl', 'curl pupitre', 'curl larry scott', 'scott curl'],
    popularity: 73,
  },
  {
    id: 'close_grip_bench',
    name: 'Développé prise serrée',
    muscles: ['Triceps', 'Pectoraux'],
    equipment: 'Barre',
    aliases: ['close grip bench', 'cgbp', 'dev prise serree', 'bench triceps'],
    popularity: 78,
  },
  {
    id: 'pendlay_row',
    name: 'Pendlay row',
    muscles: ['Dos', 'Biceps'],
    equipment: 'Barre',
    aliases: ['pendlay row', 'pendlay', 'rowing pendlay', 'dead stop row'],
    popularity: 72,
  },
  {
    id: 'box_squat',
    name: 'Squat box',
    muscles: ['Quadriceps', 'Fessiers'],
    equipment: 'Barre',
    aliases: ['box squat', 'squat box', 'squat sur box'],
    popularity: 70,
  },
  {
    id: 'incline_dumbbell_curl',
    name: 'Curl incliné',
    muscles: ['Biceps'],
    equipment: 'Haltères',
    aliases: ['incline curl', 'incline dumbbell curl', 'curl incline', 'curl banc incline'],
    popularity: 71,
  },
  {
    id: 'russian_twist',
    name: 'Russian twist',
    muscles: ['Abdos'],
    equipment: 'Autre',
    aliases: ['russian twist', 'twist russe', 'rotation russe'],
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
  goblet_squat: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU, 'functional'] },
  bulgarian_split_squat: {
    movement: 'legs',
    effortType: 'hypertrophy',
    level: 'intermediate',
    sportIds: [...MUSCU, 'functional'],
  },
  hammer_curl: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  arnold_press: { movement: 'push', effortType: 'hypertrophy', level: 'intermediate', sportIds: [...MUSCU] },
  hanging_leg_raise: { movement: 'core', effortType: 'endurance', level: 'intermediate', sportIds: [...CALI, ...CROSS] },
  kettlebell_swing: {
    movement: 'legs',
    effortType: 'endurance',
    level: 'intermediate',
    sportIds: [...CROSS, 'functional'],
  },
  chest_supported_row: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  farmer_carry: { movement: 'pull', effortType: 'endurance', level: 'beginner', sportIds: [...CROSS, 'functional'] },
  sumo_deadlift: { movement: 'pull', effortType: 'strength', level: 'intermediate', sportIds: [...POWER, 'crossfit'] },
  rear_delt_fly: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  overhead_triceps_extension: {
    movement: 'push',
    effortType: 'hypertrophy',
    level: 'beginner',
    sportIds: [...MUSCU],
  },
  seated_dumbbell_press: {
    movement: 'push',
    effortType: 'hypertrophy',
    level: 'beginner',
    sportIds: [...MUSCU],
  },
  reverse_lunge: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU, 'functional'] },
  chin_up: { movement: 'pull', effortType: 'strength', level: 'intermediate', sportIds: [...CALI, 'crossfit'] },
  concentration_curl: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  ab_wheel: { movement: 'core', effortType: 'endurance', level: 'intermediate', sportIds: [...CALI, ...CROSS] },
  good_morning: { movement: 'legs', effortType: 'strength', level: 'intermediate', sportIds: [...POWER] },
  cable_kickback: { movement: 'legs', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  preacher_curl: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  close_grip_bench: { movement: 'push', effortType: 'strength', level: 'intermediate', sportIds: [...POWER, ...MUSCU] },
  pendlay_row: { movement: 'pull', effortType: 'strength', level: 'intermediate', sportIds: [...POWER] },
  box_squat: { movement: 'legs', effortType: 'strength', level: 'intermediate', sportIds: [...POWER] },
  incline_dumbbell_curl: { movement: 'pull', effortType: 'hypertrophy', level: 'beginner', sportIds: [...MUSCU] },
  russian_twist: { movement: 'core', effortType: 'endurance', level: 'beginner', sportIds: [...CALI, ...CROSS] },
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

/** Filtre Training par sports choisis. Si aucun match catalogue → catalogue complet (pas de liste vide fake). */
export function catalogForSelectedSports(sportIds: string[] | undefined): CatalogExercise[] {
  const ids = (sportIds ?? []).filter(Boolean)
  if (ids.length === 0) return EXERCISE_CATALOG
  const filtered = EXERCISE_CATALOG.filter((ex) => ex.sportIds.some((id) => ids.includes(id)))
  return filtered.length > 0 ? filtered : EXERCISE_CATALOG
}
