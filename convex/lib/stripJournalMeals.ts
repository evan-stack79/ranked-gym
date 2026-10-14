/**
 * Retire uniquement les repas d’un journal / payload cloud (Convex).
 * Conserve eau, profil, et le reste du blob.
 */

export class StripJournalParseError extends Error {
  constructor(message = 'JOURNAL_PARSE_FAILED') {
    super(message)
    this.name = 'StripJournalParseError'
  }
}

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

export function stripMealsFromBackupPayload(payload: unknown): unknown {
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
