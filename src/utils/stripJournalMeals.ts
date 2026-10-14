/**
 * Retire uniquement les repas d’un journal / payload cloud.
 * Conserve eau, profil, train, sommeil, etc.
 */

export function stripMealsFromJournalJson(journalJson: unknown): Record<string, unknown> {
  if (!journalJson || typeof journalJson !== 'object' || Array.isArray(journalJson)) {
    return {}
  }
  const next: Record<string, unknown> = {}
  for (const [dateKey, day] of Object.entries(journalJson as Record<string, unknown>)) {
    if (!day || typeof day !== 'object' || Array.isArray(day)) {
      next[dateKey] = day
      continue
    }
    next[dateKey] = {
      ...(day as Record<string, unknown>),
      meals: [],
    }
  }
  return next
}

/** Payload type user_backups / legacy_supabase_backups / CloudBackupPayload. */
export function stripMealsFromBackupPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload
  }
  const root = { ...(payload as Record<string, unknown>) }
  const nutrition = root.nutrition
  if (nutrition && typeof nutrition === 'object' && !Array.isArray(nutrition)) {
    const n = { ...(nutrition as Record<string, unknown>) }
    if ('journal' in n) {
      n.journal = stripMealsFromJournalJson(n.journal)
    }
    if ('journalJson' in n) {
      n.journalJson = stripMealsFromJournalJson(n.journalJson)
    }
    root.nutrition = n
  }
  // Certains blobs mettent le journal à la racine
  if ('journal' in root) {
    root.journal = stripMealsFromJournalJson(root.journal)
  }
  return root
}

/** True si un nom de repas apparaît encore dans un journal-like JSON. */
export function journalJsonContainsMealName(journalJson: unknown, mealName: string): boolean {
  if (!journalJson || typeof journalJson !== 'object') return false
  for (const day of Object.values(journalJson as Record<string, unknown>)) {
    if (!day || typeof day !== 'object') continue
    const meals = (day as { meals?: unknown }).meals
    if (!Array.isArray(meals)) continue
    for (const meal of meals) {
      if (!meal || typeof meal !== 'object') continue
      if ((meal as { name?: unknown }).name === mealName) return true
    }
  }
  return false
}

export function backupPayloadContainsMealName(payload: unknown, mealName: string): boolean {
  if (!payload || typeof payload !== 'object') return false
  const root = payload as Record<string, unknown>
  const nutrition = root.nutrition
  if (nutrition && typeof nutrition === 'object') {
    const n = nutrition as Record<string, unknown>
    if (journalJsonContainsMealName(n.journal, mealName)) return true
    if (journalJsonContainsMealName(n.journalJson, mealName)) return true
  }
  if (journalJsonContainsMealName(root.journal, mealName)) return true
  // Fallback : le nom ne doit pas apparaître comme name de repas dans le JSON sérialisé
  // (évite les faux positifs sur d’autres champs en cherchant la structure meals[].name).
  return false
}
