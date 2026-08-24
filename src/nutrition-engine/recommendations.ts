import type { NutritionEngineInput } from './types'

/** Messages informatifs UI — n’altèrent jamais les macros ni target_kcal. */
export function buildRecommendations(input: NutritionEngineInput): string[] {
  const messages: string[] = []

  if (input.age >= 65) {
    messages.push(
      'Profil senior : privilégie des apports protéiques réguliers à chaque repas et une hydratation fréquente.',
    )
  }

  if (input.duration_h >= 1) {
    const baseMl = Math.round(input.duration_h * 500)
    messages.push(
      `Hydratation effort (~${input.duration_h} h) : vise ${baseMl}–${baseMl + 250} ml en plus de ta baseline, répartis pendant l’effort.`,
    )
  }

  if (input.effort_fluid_loss_l > 0) {
    const replaceMl = Math.round(input.effort_fluid_loss_l * 1000 * 1.5)
    messages.push(
      `Perte estimée ${input.effort_fluid_loss_l.toFixed(1)} L : compenser environ ${replaceMl} ml sur les 24 h suivantes (eau + électrolytes si > 1 h chaud).`,
    )
  }

  if (input.duration_h >= 2) {
    messages.push(
      'Confort digestif : évite les repas très gras juste avant l’effort ; privilégie glucides faciles à digérer 2–3 h avant.',
    )
  }

  return messages
}
