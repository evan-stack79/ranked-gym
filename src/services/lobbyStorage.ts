import type { NearbyGym } from '../types'

const CUSTOM_GYMS_KEY = 'ranked-gym:custom-gyms'
const CHECK_IN_KEY = 'ranked-gym:check-in'
export const CHECK_IN_TTL_MS = 3 * 60 * 60 * 1000

export interface StoredCheckIn {
  gymId: string
  gymName: string
  checkedInAt: number
  gym: NearbyGym
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

export function getCustomGyms(): NearbyGym[] {
  return readJson<NearbyGym[]>(CUSTOM_GYMS_KEY, []).map((gym) => ({
    ...gym,
    isCustom: true,
    canCheckIn: true,
  }))
}

export function saveCustomGym(gym: NearbyGym): void {
  const gyms = getCustomGyms()
  const withoutDuplicate = gyms.filter((g) => g.id !== gym.id)
  writeJson(CUSTOM_GYMS_KEY, [{ ...gym, isCustom: true, canCheckIn: true }, ...withoutDuplicate])
}

export function mergeWithCustomGyms(apiGyms: NearbyGym[]): NearbyGym[] {
  const customGyms = getCustomGyms()
  const apiIds = new Set(apiGyms.map((g) => g.id))
  const uniqueCustom = customGyms.filter((g) => !apiIds.has(g.id))
  return [...uniqueCustom, ...apiGyms]
}

export function saveCheckIn(gym: NearbyGym): void {
  const payload: StoredCheckIn = {
    gymId: gym.id,
    gymName: gym.name,
    checkedInAt: Date.now(),
    gym,
  }
  writeJson(CHECK_IN_KEY, payload)
}

export function getActiveCheckIn(): StoredCheckIn | null {
  const stored = readJson<StoredCheckIn | null>(CHECK_IN_KEY, null)
  if (!stored) return null

  const elapsed = Date.now() - stored.checkedInAt
  if (elapsed > CHECK_IN_TTL_MS) {
    clearCheckIn()
    return null
  }

  return stored
}

export function clearCheckIn(): void {
  localStorage.removeItem(CHECK_IN_KEY)
}

export function formatCheckInDuration(checkedInAt: number): string {
  const minutes = Math.floor((Date.now() - checkedInAt) / 60_000)
  if (minutes < 1) return 'à l\'instant'
  if (minutes < 60) return `depuis ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0
    ? `depuis ${hours} h ${remainingMinutes} min`
    : `depuis ${hours} h`
}
