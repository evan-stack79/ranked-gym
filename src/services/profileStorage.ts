const PROFILE_KEY = 'ranked-gym:profile'

export interface StoredProfileProgress {
  level: number
  currentXp: number
  xpToNextLevel: number
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

function writeJson<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function getProfileProgress(): StoredProfileProgress {
  const stored = readJson<Partial<StoredProfileProgress>>(PROFILE_KEY, {})
  return {
    level: stored.level ?? DEFAULT_PROGRESS.level,
    currentXp: stored.currentXp ?? DEFAULT_PROGRESS.currentXp,
    xpToNextLevel: stored.xpToNextLevel ?? DEFAULT_PROGRESS.xpToNextLevel,
  }
}

export function saveProfileProgress(progress: StoredProfileProgress): void {
  writeJson(PROFILE_KEY, progress)
}

export function getDefaultProfileProgress(): StoredProfileProgress {
  return { ...DEFAULT_PROGRESS }
}
