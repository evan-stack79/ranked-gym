import type { NutritionEngineInput } from './types'

const DIGESTIVE_COMFORT =
  'Confort digestif : évite les repas très gras juste avant l’effort ; privilégie glucides faciles à digérer 2–3 h avant.'

const INTRA_EFFORT =
  "Pendant l'effort, consommez 0,5 à 1 L de liquide par heure contenant 30 à 60g de glucides."

const SENIOR_PROTEIN =
  "Pour stimuler le muscle de façon optimale, visez des portions de protéines d'environ 40g par repas."

/** Messages informatifs UI — n’altèrent jamais les macros ni target_kcal. */
export function buildRecommendations(input: NutritionEngineInput): string[] {
  const messages: string[] = []

  const baseLiters = (input.weight_kg * 35) / 1000
  messages.push(`Hydratation de base : visez ${baseLiters.toFixed(1)} L par jour.`)

  if (input.age > 65) {
    messages.push(SENIOR_PROTEIN)
  }

  if (input.duration_h > 1 && input.intensity === 'high') {
    messages.push(INTRA_EFFORT)
  }

  const weightLossKg =
    input.effort_weight_loss_kg > 0
      ? input.effort_weight_loss_kg
      : input.effort_fluid_loss_l > 0
        ? input.effort_fluid_loss_l
        : 0

  if (weightLossKg > 0) {
    const liters = weightLossKg * 1.5
    messages.push(`Buvez ${liters.toFixed(2)} Litres dans les heures suivant votre séance.`)
  }

  if (input.duration_h >= 2) {
    messages.push(DIGESTIVE_COMFORT)
  }

  return messages
}
