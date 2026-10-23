/** Masse maigre (kg) = poids × (1 − bodyfat/100). */
export function computeLeanMassKg(weightKg: number | null, bodyfat: number | null): number | null {
  if (weightKg == null || bodyfat == null) return null
  if (weightKg <= 0 || bodyfat < 0 || bodyfat >= 100) return null
  return Math.round(weightKg * (1 - bodyfat / 100) * 10) / 10
}

/** FFMI = masse_maigre / (taille_m²). */
export function computeFfmi(leanMassKg: number | null, heightCm: number | null): number | null {
  if (leanMassKg == null || heightCm == null || heightCm <= 0) return null
  const heightM = heightCm / 100
  if (heightM <= 0) return null
  return Math.round((leanMassKg / (heightM * heightM)) * 10) / 10
}

/** Compteur IA du jour : reset si lastAiCallDate ≠ aujourd’hui (YYYY-MM-DD). */
export function effectiveAiCallsToday(
  aiCallsToday: number | undefined,
  lastAiCallDate: string | undefined,
  today: string,
): number {
  if (!lastAiCallDate || lastAiCallDate !== today) return 0
  const n = typeof aiCallsToday === 'number' && Number.isFinite(aiCallsToday) ? aiCallsToday : 0
  return Math.max(0, Math.floor(n))
}
