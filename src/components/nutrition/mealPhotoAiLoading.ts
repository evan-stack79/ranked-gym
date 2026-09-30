/** Étapes visuelles du scan photo repas — progress perçu, pas un journal backend. */

export type MealPhotoAiSequence = {
  status: string
  lines: string[]
}

export const MEAL_PHOTO_AI_LINE_HEIGHT_PX = 28
export const MEAL_PHOTO_AI_VISIBLE_LINES = 3
export const MEAL_PHOTO_AI_TICK_MS = 1600
export const MEAL_PHOTO_AI_PROGRESS_CAP = 92

export const MEAL_PHOTO_AI_SEQUENCES: MealPhotoAiSequence[] = [
  {
    status: 'Lecture de la photo',
    lines: [
      'Chargement de l’image…',
      'Détection du plat…',
      'Identification des aliments…',
      'Repérage des portions…',
      'Vérification de la netteté…',
    ],
  },
  {
    status: 'Analyse nutritionnelle',
    lines: [
      'Estimation des calories…',
      'Calcul des protéines…',
      'Calcul des glucides…',
      'Calcul des lipides…',
      'Ajustement des quantités…',
      'Contrôle de cohérence…',
    ],
  },
  {
    status: 'Préparation du résumé',
    lines: [
      'Compilation des macros…',
      'Vérification des portions…',
      'Mise en forme du résultat…',
      'Dernier contrôle…',
    ],
  },
]

export type MealPhotoAiFlatStep = {
  sequenceIndex: number
  lineIndex: number
  number: number
  text: string
  status: string
}

export function flattenMealPhotoAiSteps(
  sequences: MealPhotoAiSequence[] = MEAL_PHOTO_AI_SEQUENCES,
): MealPhotoAiFlatStep[] {
  return sequences.flatMap((sequence, sequenceIndex) =>
    sequence.lines.map((text, lineIndex) => ({
      sequenceIndex,
      lineIndex,
      number: lineIndex + 1,
      text,
      status: sequence.status,
    })),
  )
}

export function mealPhotoAiProgressPercent(stepIndex: number, totalSteps: number): number {
  if (!Number.isFinite(stepIndex) || !Number.isFinite(totalSteps) || totalSteps <= 0) {
    return 0
  }
  const clamped = Math.max(0, Math.min(stepIndex + 1, totalSteps))
  return Math.min(MEAL_PHOTO_AI_PROGRESS_CAP, Math.round((clamped / totalSteps) * 100))
}

export function resolveMealPhotoAiStep(
  cursor: number,
  sequences: MealPhotoAiSequence[] = MEAL_PHOTO_AI_SEQUENCES,
): {
  step: MealPhotoAiFlatStep
  index: number
  progress: number
  total: number
} {
  const steps = flattenMealPhotoAiSteps(sequences)
  const total = steps.length
  if (total === 0) {
    return {
      step: { sequenceIndex: 0, lineIndex: 0, number: 1, text: '', status: '' },
      index: 0,
      progress: 0,
      total: 0,
    }
  }
  const safeCursor = Number.isFinite(cursor) ? Math.max(0, Math.floor(cursor)) : 0
  const index = safeCursor % total
  const step = steps[index] ?? steps[0]
  return {
    step,
    index,
    progress: mealPhotoAiProgressPercent(index, total),
    total,
  }
}
