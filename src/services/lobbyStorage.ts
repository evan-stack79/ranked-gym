import type { NearbyGym } from '../types'
import { getActiveCloudUserId } from './cloudSession'

const CUSTOM_GYMS_BASE = 'ranked-gym:custom-gyms'
const CHECK_IN_BASE = 'ranked-gym:check-in'
export const CHECK_IN_TTL_MS = 3 * 60 * 60 * 1000

export type StorageSaveOptions = {
  skipCloud?: boolean
  checkedInAt?: number
}

function triggerCloudBackup() {
  void import('./cloudBackup').then((m) => m.notifyLocalDataChanged())
}

function scopedKey(base: string): string {
  const uid = getActiveCloudUserId()
  return uid ? `${base}:u:${uid}` : base
}

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

function writeJson<T>(key: string, value: T, opts?: StorageSaveOptions): void {
  localStorage.setItem(key, JSON.stringify(value))
  if (!opts?.skipCloud) triggerCloudBackup()
}

export function getCustomGyms(): NearbyGym[] {
  return readJson<NearbyGym[]>(scopedKey(CUSTOM_GYMS_BASE), []).map((gym) => ({
    ...gym,
    isCustom: true,
    canCheckIn: true,
  }))
}

export function saveCustomGyms(gyms: NearbyGym[], opts?: StorageSaveOptions): void {
  writeJson(
    scopedKey(CUSTOM_GYMS_BASE),
    gyms.map((g) => ({ ...g, isCustom: true, canCheckIn: true })),
    opts,
  )
}

export function saveCustomGym(gym: NearbyGym, opts?: StorageSaveOptions): void {
  const gyms = getCustomGyms()
  const withoutDuplicate = gyms.filter((g) => g.id !== gym.id)
  writeJson(
    scopedKey(CUSTOM_GYMS_BASE),
    [{ ...gym, isCustom: true, canCheckIn: true }, ...withoutDuplicate],
    opts,
  )
}

export function mergeWithCustomGyms(apiGyms: NearbyGym[]): NearbyGym[] {
  const customGyms = getCustomGyms()
  const apiIds = new Set(apiGyms.map((g) => g.id))
  const uniqueCustom = customGyms.filter((g) => !apiIds.has(g.id))
  return [...uniqueCustom, ...apiGyms]
}

export function saveCheckIn(gym: NearbyGym, opts?: StorageSaveOptions): void {
  const payload: StoredCheckIn = {
    gymId: gym.id,
    gymName: gym.name,
    checkedInAt: opts?.checkedInAt ?? Date.now(),
    gym,
  }
  writeJson(scopedKey(CHECK_IN_BASE), payload, opts)
}

export function getActiveCheckIn(): StoredCheckIn | null {
  const stored = readJson<StoredCheckIn | null>(scopedKey(CHECK_IN_BASE), null)
  if (!stored) return null

  const elapsed = Date.now() - stored.checkedInAt
  if (elapsed > CHECK_IN_TTL_MS) {
    clearCheckIn()
    return null
  }

  return stored
}

export function clearCheckIn(opts?: StorageSaveOptions): void {
  localStorage.removeItem(scopedKey(CHECK_IN_BASE))
  if (!opts?.skipCloud) triggerCloudBackup()
}

export function formatCheckInDuration(checkedInAt: number): string {
  const minutes = Math.floor((Date.now() - checkedInAt) / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `depuis ${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0
    ? `depuis ${hours} h ${remainingMinutes} min`
    : `depuis ${hours} h`
}
