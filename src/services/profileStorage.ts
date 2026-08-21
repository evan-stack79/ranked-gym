import { getActiveCloudUserId } from './cloudSession'

const PROFILE_BASE = 'ranked-gym:profile'

export type StorageSaveOptions = { skipCloud?: boolean }

function triggerCloudBackup() {
  void import('./cloudBackup').then((m) => m.notifyLocalDataChanged())
}

function scopedKey(): string {
  const uid = getActiveCloudUserId()
  return uid ? `${PROFILE_BASE}:u:${uid}` : PROFILE_BASE
}

export interface StoredProfileProgress {
  level: number
  currentXp: number
  xpToNextLevel: number
  /** PR épinglé — on stocke surtout le nom ; le poids est recalculé live. */
  pinnedPr?: { exerciseName: string; weightKg?: number } | null
}

const DEFAULT_PROGRESS: StoredProfileProgress = {
  level: 42,
  currentXp: 850,
  xpToNextLevel: 1000,
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson<T>(key: string, value: T, opts?: StorageSaveOptions): void {
  localStorage.setItem(key, JSON.stringify(value))
  if (!opts?.skipCloud) triggerCloudBackup()
}

export function getProfileProgress(): StoredProfileProgress {
  const stored = readJson<Partial<StoredProfileProgress>>(scopedKey(), {})
  return {
    level: stored.level ?? DEFAULT_PROGRESS.level,
    currentXp: stored.currentXp ?? DEFAULT_PROGRESS.currentXp,
    xpToNextLevel: stored.xpToNextLevel ?? DEFAULT_PROGRESS.xpToNextLevel,
    pinnedPr:
      stored.pinnedPr && typeof stored.pinnedPr.exerciseName === 'string'
        ? {
            exerciseName: stored.pinnedPr.exerciseName,
            weightKg:
              typeof stored.pinnedPr.weightKg === 'number' ? stored.pinnedPr.weightKg : undefined,
          }
        : null,
  }
}

export function saveProfileProgress(
  progress: StoredProfileProgress,
  opts?: StorageSaveOptions,
): void {
  writeJson(scopedKey(), progress, opts)
}

export function getPinnedPr(): { exerciseName: string; weightKg?: number } | null {
  return getProfileProgress().pinnedPr ?? null
}

export function setPinnedPr(
  pinned: { exerciseName: string; weightKg?: number } | null,
  opts?: StorageSaveOptions,
): void {
  const current = getProfileProgress()
  saveProfileProgress(
    {
      ...current,
      pinnedPr: pinned
        ? { exerciseName: pinned.exerciseName, weightKg: pinned.weightKg }
        : null,
    },
    opts,
  )
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('ranked-gym:pinned-pr-changed'))
  }
}

export function getDefaultProfileProgress(): StoredProfileProgress {
  return { ...DEFAULT_PROGRESS }
}
