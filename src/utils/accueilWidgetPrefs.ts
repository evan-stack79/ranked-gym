/**
 * Accueil widget preferences — stored separately from profile/settings (R-04).
 * Shape: { version, order, hidden, updatedAt }. localStorage only.
 *
 * v1 → v2: new metric tiles.
 * Water goal lives in `userWaterGoal.ts` (`ranked-gym:water-goal`). Legacy
 * `waterGoalMl` on prefs is migrated once via `migrateAccueilWaterGoalFromPrefs`.
 */

import {
  clearUserWaterGoal,
  getUserWaterGoalMl,
  migrateAccueilWaterGoalFromPrefs,
  normalizeUserWaterGoalMl,
  setUserWaterGoalMl,
} from './userWaterGoal'

export const ACCUEIL_WIDGET_PREFS_KEY = 'ranked-gym:accueil-widget-prefs'
export const ACCUEIL_WIDGET_PREFS_VERSION = 2 as const

/** Known Accueil gallery blocks — training / water only; never kcal/weight/body. */
export const ACCUEIL_WIDGET_IDS = [
  'seance',
  'seances_semaine',
  'eau',
  'series_jour',
  'prochaine_seance',
  'recent',
  'programme',
] as const

export type AccueilWidgetId = (typeof ACCUEIL_WIDGET_IDS)[number]

export type AccueilWidgetPrefs = {
  version: number
  order: string[]
  hidden: string[]
  updatedAt: number
  /**
   * @deprecated Legacy field — water goal is `ranked-gym:water-goal`.
   * Kept optional so old payloads parse; always normalized to null on write.
   */
  waterGoalMl?: number | null
}

export const ACCUEIL_WIDGET_LABELS: Record<AccueilWidgetId, string> = {
  seance: 'Séance du jour',
  seances_semaine: 'Séances de la semaine',
  eau: 'Eau',
  series_jour: 'Séries du jour',
  prochaine_seance: 'Prochaine séance',
  recent: 'Récent',
  programme: 'Programme',
}

/** Wide tiles span the Accueil grid; small ones share a 2-column row. */
export const ACCUEIL_WIDGET_SIZE: Record<AccueilWidgetId, 'wide' | 'small'> = {
  seance: 'wide',
  seances_semaine: 'wide',
  eau: 'small',
  series_jour: 'small',
  prochaine_seance: 'wide',
  recent: 'wide',
  programme: 'wide',
}

/** Default Accueil: heroes → week → water/sets → next → programme → recent. */
export const DEFAULT_ACCUEIL_WIDGET_ORDER: AccueilWidgetId[] = [
  'seance',
  'seances_semaine',
  'eau',
  'series_jour',
  'prochaine_seance',
  'programme',
  'recent',
]

/** Clamp a user water goal; returns null when unset / invalid. */
export function normalizeWaterGoalMl(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(20_000, Math.round(n))
}

export function createDefaultAccueilWidgetPrefs(now = Date.now()): AccueilWidgetPrefs {
  return {
    version: ACCUEIL_WIDGET_PREFS_VERSION,
    order: [...DEFAULT_ACCUEIL_WIDGET_ORDER],
    hidden: [],
    updatedAt: now,
    waterGoalMl: null,
  }
}

function isKnownWidgetId(id: string): id is AccueilWidgetId {
  return (ACCUEIL_WIDGET_IDS as readonly string[]).includes(id)
}

/**
 * Drop unknown ids silently; append any new known widgets missing from `order`
 * in their default relative position. Dedupes order/hidden. Migrates older versions.
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
    // Never persist a goal here — single source is userWaterGoal.
    waterGoalMl: null,
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

/**
 * Drag-reorder among visible tiles: move `draggedId` to `targetId`'s visible slot.
 * Hidden ids keep their relative places in `order`.
 */
export function reorderVisibleAccueilWidget(
  prefs: AccueilWidgetPrefs,
  draggedId: AccueilWidgetId,
  targetId: AccueilWidgetId,
  now = Date.now(),
): AccueilWidgetPrefs {
  const normalized = normalizeAccueilWidgetPrefs(prefs, now)
  if (draggedId === targetId) return { ...normalized, updatedAt: now }
  if (!isKnownWidgetId(draggedId) || !isKnownWidgetId(targetId)) {
    return { ...normalized, updatedAt: now }
  }
  const hidden = new Set(normalized.hidden)
  const visible = normalized.order.filter(
    (id): id is AccueilWidgetId => isKnownWidgetId(id) && !hidden.has(id),
  )
  const from = visible.indexOf(draggedId)
  const to = visible.indexOf(targetId)
  if (from < 0 || to < 0) return { ...normalized, updatedAt: now }
  const nextVisible = [...visible]
  const [item] = nextVisible.splice(from, 1)
  nextVisible.splice(to, 0, item!)
  let v = 0
  const order = normalized.order.map((id) => {
    if (hidden.has(id) || !isKnownWidgetId(id)) return id
    return nextVisible[v++]!
  })
  return { ...normalized, order, updatedAt: now }
}

export function hideAccueilWidget(
  prefs: AccueilWidgetPrefs,
  id: AccueilWidgetId,
  now = Date.now(),
): AccueilWidgetPrefs {
  const normalized = normalizeAccueilWidgetPrefs(prefs, now)
  if (normalized.hidden.includes(id)) return { ...normalized, updatedAt: now }
  return toggleAccueilWidgetHidden(normalized, id, now)
}

export function showAccueilWidget(
  prefs: AccueilWidgetPrefs,
  id: AccueilWidgetId,
  now = Date.now(),
): AccueilWidgetPrefs {
  const normalized = normalizeAccueilWidgetPrefs(prefs, now)
  if (!normalized.hidden.includes(id)) return { ...normalized, updatedAt: now }
  return toggleAccueilWidgetHidden(normalized, id, now)
}

/** Hidden widgets in order (for « + Ajouter »). */
export function resolveHiddenAccueilWidgets(prefs: AccueilWidgetPrefs): AccueilWidgetId[] {
  const normalized = normalizeAccueilWidgetPrefs(prefs)
  const hidden = new Set(normalized.hidden)
  return normalized.order.filter((id): id is AccueilWidgetId => isKnownWidgetId(id) && hidden.has(id))
}

/**
 * @deprecated Prefer `setUserWaterGoalMl`. Writes the shared water-goal key and
 * returns prefs with `waterGoalMl` cleared (single source of truth).
 */
export function setAccueilWaterGoalMl(
  prefs: AccueilWidgetPrefs,
  waterGoalMl: number | null,
  now = Date.now(),
): AccueilWidgetPrefs {
  const goal = normalizeUserWaterGoalMl(
    waterGoalMl == null ? null : typeof waterGoalMl === 'number' ? waterGoalMl : Number(waterGoalMl),
  )
  if (goal != null) setUserWaterGoalMl(goal, now)
  else clearUserWaterGoal()
  return {
    ...normalizeAccueilWidgetPrefs(prefs, now),
    waterGoalMl: null,
    updatedAt: now,
  }
}

/** True when the shared user water goal is set (prefs field ignored). */
export function hasUserWaterGoal(_prefs?: AccueilWidgetPrefs): boolean {
  return getUserWaterGoalMl() != null
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
    // Migrate legacy prefs.waterGoalMl → ranked-gym:water-goal before normalize strips it.
    migrateAccueilWaterGoalFromPrefs(now)
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
