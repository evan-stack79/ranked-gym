/**
 * Retire uniquement les repas d’un journal / payload cloud.
 * Conserve eau, profil, train, sommeil, etc.
 */

export class StripJournalParseError extends Error {
  constructor(message = 'JOURNAL_PARSE_FAILED') {
    super(message)
    this.name = 'StripJournalParseError'
  }
}

/** Parse un journal éventuellement stocké en string JSON. */
export function parseJournalObject(raw: unknown): Record<string, unknown> {
  if (raw == null) return {}
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return {}
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new StripJournalParseError('JOURNAL_PARSE_FAILED')
      }
      return parsed as Record<string, unknown>
    } catch (error) {
      if (error instanceof StripJournalParseError) throw error
      throw new StripJournalParseError('JOURNAL_PARSE_FAILED')
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  throw new StripJournalParseError('JOURNAL_PARSE_FAILED')
}

export function stripMealsFromJournalJson(journalJson: unknown): Record<string, unknown> {
  const journal = parseJournalObject(journalJson)
  const next: Record<string, unknown> = {}
  for (const [dateKey, day] of Object.entries(journal)) {
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

/** Compte les repas présents dans un journal (après parse). */
export function countMealsInJournalJson(journalJson: unknown): number {
  const journal = parseJournalObject(journalJson)
  let count = 0
  for (const day of Object.values(journal)) {
    if (!day || typeof day !== 'object' || Array.isArray(day)) continue
    const meals = (day as { meals?: unknown }).meals
    if (Array.isArray(meals)) count += meals.length
  }
  return count
}

/** Payload type user_backups / legacy_supabase_backups / CloudBackupPayload. */
export function stripMealsFromBackupPayload(payload: unknown): {
  payload: unknown
  mealsRemoved: number
} {
  let rootRaw: unknown = payload
  if (typeof payload === 'string') {
    try {
      rootRaw = JSON.parse(payload)
    } catch {
      throw new StripJournalParseError('JOURNAL_PARSE_FAILED')
    }
  }
  if (!rootRaw || typeof rootRaw !== 'object' || Array.isArray(rootRaw)) {
    throw new StripJournalParseError('JOURNAL_PARSE_FAILED')
  }
  const root = { ...(rootRaw as Record<string, unknown>) }
  let mealsRemoved = 0

  const nutrition = root.nutrition
  if (nutrition && typeof nutrition === 'object' && !Array.isArray(nutrition)) {
    const n = { ...(nutrition as Record<string, unknown>) }
    if ('journal' in n) {
      mealsRemoved += countMealsInJournalJson(n.journal)
      n.journal = stripMealsFromJournalJson(n.journal)
    }
    if ('journalJson' in n) {
      mealsRemoved += countMealsInJournalJson(n.journalJson)
      n.journalJson = stripMealsFromJournalJson(n.journalJson)
    }
    root.nutrition = n
  }
  if ('journal' in root) {
    mealsRemoved += countMealsInJournalJson(root.journal)
    root.journal = stripMealsFromJournalJson(root.journal)
  }
  return { payload: root, mealsRemoved }
}

/** True si un nom de repas apparaît encore dans un journal-like JSON. */
export function journalJsonContainsMealName(journalJson: unknown, mealName: string): boolean {
  let journal: Record<string, unknown>
  try {
    journal = parseJournalObject(journalJson)
  } catch {
    return false
  }
  for (const day of Object.values(journal)) {
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
  let rootRaw: unknown = payload
  if (typeof payload === 'string') {
    try {
      rootRaw = JSON.parse(payload)
    } catch {
      return false
    }
  }
  if (!rootRaw || typeof rootRaw !== 'object') return false
  const root = rootRaw as Record<string, unknown>
  const nutrition = root.nutrition
  if (nutrition && typeof nutrition === 'object') {
    const n = nutrition as Record<string, unknown>
    if (journalJsonContainsMealName(n.journal, mealName)) return true
    if (journalJsonContainsMealName(n.journalJson, mealName)) return true
  }
  if (journalJsonContainsMealName(root.journal, mealName)) return true
  return false
}
