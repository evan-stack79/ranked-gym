/**
 * Accueil widget preferences — stored separately from profile/settings (R-04).
 * Shape: { version, order, hidden, updatedAt }. localStorage only for this PR.
 */

export const ACCUEIL_WIDGET_PREFS_KEY = 'ranked-gym:accueil-widget-prefs'
export const ACCUEIL_WIDGET_PREFS_VERSION = 1 as const

/** Known Accueil gallery blocks — training-related only; never kcal/weight/body. */
export const ACCUEIL_WIDGET_IDS = ['seance', 'recent', 'programme'] as const

export type AccueilWidgetId = (typeof ACCUEIL_WIDGET_IDS)[number]

export type AccueilWidgetPrefs = {
  version: typeof ACCUEIL_WIDGET_PREFS_VERSION
  order: string[]
  hidden: string[]
  updatedAt: number
}

export const ACCUEIL_WIDGET_LABELS: Record<AccueilWidgetId, string> = {
  seance: 'Séance du jour',
  recent: 'Récent',
  programme: 'Programme',
}

/** Default Accueil: Séance du jour → Récent → Programme, all visible. */
export const DEFAULT_ACCUEIL_WIDGET_ORDER: AccueilWidgetId[] = [
  'seance',
  'recent',
  'programme',
]

export function createDefaultAccueilWidgetPrefs(now = Date.now()): AccueilWidgetPrefs {
  return {
    version: ACCUEIL_WIDGET_PREFS_VERSION,
    order: [...DEFAULT_ACCUEIL_WIDGET_ORDER],
    hidden: [],
    updatedAt: now,
  }
}

function isKnownWidgetId(id: string): id is AccueilWidgetId {
  return (ACCUEIL_WIDGET_IDS as readonly string[]).includes(id)
}

/**
 * Drop unknown ids silently; append any new known widgets missing from `order`
 * in their default relative position. Dedupes order/hidden.
 */
export function normalizeAccueilWidgetPrefs(
  input: Partial<AccueilWidgetPrefs> | null | undefined,
  now = Date.now(),
): AccueilWidgetPrefs {
  const rawOrder = Array.isArray(input?.order) ? input.order : []
  const rawHidden = Array.isArray(input?.hidden) ? input.hidden : []

  const seen = new Set<string>()
  const order: AccueilWidgetId[] = []
  for (const id of rawOrder) {
    if (typeof id !== 'string' || !isKnownWidgetId(id) || seen.has(id)) continue
    seen.add(id)
    order.push(id)
  }

  for (const defaultId of DEFAULT_ACCUEIL_WIDGET_ORDER) {
    if (seen.has(defaultId)) continue
    const defaultIndex = DEFAULT_ACCUEIL_WIDGET_ORDER.indexOf(defaultId)
    let insertAt = order.length
    for (let i = 0; i < order.length; i++) {
      const existingDefaultIndex = DEFAULT_ACCUEIL_WIDGET_ORDER.indexOf(order[i]!)
      if (existingDefaultIndex > defaultIndex) {
        insertAt = i
        break
      }
    }
    order.splice(insertAt, 0, defaultId)
    seen.add(defaultId)
  }

  const hiddenSeen = new Set<string>()
  const hidden: AccueilWidgetId[] = []
  for (const id of rawHidden) {
    if (typeof id !== 'string' || !isKnownWidgetId(id) || hiddenSeen.has(id)) continue
    hiddenSeen.add(id)
    hidden.push(id)
  }

  const updatedAt =
    typeof input?.updatedAt === 'number' && Number.isFinite(input.updatedAt)
      ? input.updatedAt
      : now

  return {
    version: ACCUEIL_WIDGET_PREFS_VERSION,
    order,
    hidden,
    updatedAt,
  }
}

/**
 * Merge local + remote copies: always keep the one with the latest updatedAt.
 * Equal timestamps → prefer local (never blindly overwrite local with remote).
 */
export function mergeAccueilWidgetPrefs(
  local: AccueilWidgetPrefs | null | undefined,
  remote: AccueilWidgetPrefs | null | undefined,
  now = Date.now(),
): AccueilWidgetPrefs {
  const localNorm = local ? normalizeAccueilWidgetPrefs(local, now) : null
  const remoteNorm = remote ? normalizeAccueilWidgetPrefs(remote, now) : null

  if (!localNorm && !remoteNorm) return createDefaultAccueilWidgetPrefs(now)
  if (!localNorm) return remoteNorm!
  if (!remoteNorm) return localNorm
  if (remoteNorm.updatedAt > localNorm.updatedAt) return remoteNorm
  return localNorm
}

export function resetAccueilWidgetPrefs(now = Date.now()): AccueilWidgetPrefs {
  return createDefaultAccueilWidgetPrefs(now)
}

/** Visible widgets in display order (known ids only, not hidden). */
export function resolveVisibleAccueilWidgets(prefs: AccueilWidgetPrefs): AccueilWidgetId[] {
  const normalized = normalizeAccueilWidgetPrefs(prefs)
  const hidden = new Set(normalized.hidden)
  return normalized.order.filter((id): id is AccueilWidgetId => isKnownWidgetId(id) && !hidden.has(id))
}

export function isAccueilWidgetVisible(prefs: AccueilWidgetPrefs, id: AccueilWidgetId): boolean {
  return !normalizeAccueilWidgetPrefs(prefs).hidden.includes(id)
}

export function toggleAccueilWidgetHidden(
  prefs: AccueilWidgetPrefs,
  id: AccueilWidgetId,
  now = Date.now(),
): AccueilWidgetPrefs {
  const normalized = normalizeAccueilWidgetPrefs(prefs, now)
  const hidden = new Set(normalized.hidden)
  if (hidden.has(id)) hidden.delete(id)
  else hidden.add(id)
  return {
    ...normalized,
    hidden: ACCUEIL_WIDGET_IDS.filter((w) => hidden.has(w)),
    updatedAt: now,
  }
}

export function moveAccueilWidget(
  prefs: AccueilWidgetPrefs,
  id: AccueilWidgetId,
  direction: 'up' | 'down',
  now = Date.now(),
): AccueilWidgetPrefs {
  const normalized = normalizeAccueilWidgetPrefs(prefs, now)
  const order = [...normalized.order]
  const index = order.indexOf(id)
  if (index < 0) return { ...normalized, updatedAt: now }
  const target = direction === 'up' ? index - 1 : index + 1
  if (target < 0 || target >= order.length) return { ...normalized, updatedAt: now }
  const swap = order[target]!
  order[target] = id
  order[index] = swap
  return { ...normalized, order, updatedAt: now }
}

function parseStoredPrefs(raw: string | null): AccueilWidgetPrefs | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<AccueilWidgetPrefs>
    if (!parsed || typeof parsed !== 'object') return null
    return normalizeAccueilWidgetPrefs(parsed)
  } catch {
    return null
  }
}

export function loadAccueilWidgetPrefs(now = Date.now()): AccueilWidgetPrefs {
  if (typeof localStorage === 'undefined') return createDefaultAccueilWidgetPrefs(now)
  try {
    const stored = parseStoredPrefs(localStorage.getItem(ACCUEIL_WIDGET_PREFS_KEY))
    return stored ?? createDefaultAccueilWidgetPrefs(now)
  } catch {
    return createDefaultAccueilWidgetPrefs(now)
  }
}

export function saveAccueilWidgetPrefs(prefs: AccueilWidgetPrefs): AccueilWidgetPrefs {
  const normalized = normalizeAccueilWidgetPrefs(prefs)
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(ACCUEIL_WIDGET_PREFS_KEY, JSON.stringify(normalized))
    } catch {
      // Quota / private mode — keep in-memory result.
    }
  }
  return normalized
}

/**
 * Merge a candidate remote copy into localStorage using latest updatedAt.
 * Used when a future sync path appears — safe no-op if remote is older/missing.
 */
export function applyRemoteAccueilWidgetPrefs(
  remote: AccueilWidgetPrefs | null | undefined,
  now = Date.now(),
): AccueilWidgetPrefs {
  const local = loadAccueilWidgetPrefs(now)
  const merged = mergeAccueilWidgetPrefs(local, remote, now)
  return saveAccueilWidgetPrefs(merged)
}
