/**
 * Retire uniquement les repas d’un journal / payload cloud (Convex).
 * Conserve eau, profil, et le reste du blob.
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
  if ('journal' in root) {
    root.journal = stripMealsFromJournalJson(root.journal)
  }
  return root
}
