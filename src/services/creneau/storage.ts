/**
 * Mon créneau — local storage (scoped per cloud user). No Convex schema change.
 */

import { getActiveCloudUserId } from '../cloudSession'
import { readLocal, removeLocal, writeLocal } from '../secureLocalStore'
import type { CreneauCrowdLevel } from '../../creneau/constants'
import type { CrowdReport } from '../../creneau/engine'
import { TERGNIER_COORDS } from '../../creneau/sunset'

export const CRENEAU_STORAGE_BASE = 'ranked-gym:creneau'
export const CRENEAU_CHANGED_EVENT = 'ranked-gym:creneau-changed'

export type CreneauGymPrefs = {
  id: string
  name: string
  travelFromWorkMin: number
  travelFromHomeMin: number
  staffFromHm: string | null
  staffUntilHm: string | null
  closesHm: string | null
  /** Ville / coords pour B2 sunset (salle). */
  city?: string
  latitude?: number
  longitude?: number
}

export type CreneauSettings = {
  favorite: CreneauGymPrefs | null
  backup: CreneauGymPrefs | null
  trajetMode: 'pied' | 'velo' | 'transports' | 'voiture'
  lockerMin: number
  eveningWalkEnabled: boolean
  stafflessGymEnabled: boolean
  preferQuiet: boolean
  heatVigilanceToday: boolean
  crowdReports: CrowdReport[]
}

const DEFAULTS: CreneauSettings = {
  favorite: null,
  backup: null,
  trajetMode: 'pied',
  lockerMin: 10,
  eveningWalkEnabled: false,
  stafflessGymEnabled: false,
  preferQuiet: true,
  heatVigilanceToday: false,
  crowdReports: [],
}

function scopedKey(): string {
  const uid = getActiveCloudUserId()
  return uid ? `${CRENEAU_STORAGE_BASE}:u:${uid}` : CRENEAU_STORAGE_BASE
}

function notify(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CRENEAU_CHANGED_EVENT))
  }
}

function sanitizeGym(raw: unknown): CreneauGymPrefs | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Partial<CreneauGymPrefs>
  if (typeof g.id !== 'string' || typeof g.name !== 'string') return null
  const name = g.name.trim().slice(0, 60)
  if (!name) return null
  return {
    id: g.id.slice(0, 80),
    name,
    travelFromWorkMin:
      typeof g.travelFromWorkMin === 'number' && Number.isFinite(g.travelFromWorkMin)
        ? Math.max(0, Math.min(180, Math.round(g.travelFromWorkMin)))
        : 15,
    travelFromHomeMin:
      typeof g.travelFromHomeMin === 'number' && Number.isFinite(g.travelFromHomeMin)
        ? Math.max(0, Math.min(180, Math.round(g.travelFromHomeMin)))
        : 20,
    staffFromHm: typeof g.staffFromHm === 'string' ? g.staffFromHm : null,
    staffUntilHm: typeof g.staffUntilHm === 'string' ? g.staffUntilHm : '22:00',
    closesHm: typeof g.closesHm === 'string' ? g.closesHm : null,
    city: typeof g.city === 'string' ? g.city.slice(0, 60) : undefined,
    latitude:
      typeof g.latitude === 'number' && Number.isFinite(g.latitude)
        ? g.latitude
        : undefined,
    longitude:
      typeof g.longitude === 'number' && Number.isFinite(g.longitude)
        ? g.longitude
        : undefined,
  }
}

function sanitizeReport(r: unknown): CrowdReport | null {
  if (!r || typeof r !== 'object') return null
  const x = r as CrowdReport
  if (typeof x.gymId !== 'string' || typeof x.atMs !== 'number') return null
  if (!['calme', 'moyen', 'charge'].includes(x.level)) return null
  return {
    gymId: x.gymId,
    level: x.level,
    atMs: x.atMs,
    personId: typeof x.personId === 'string' ? x.personId.slice(0, 120) : undefined,
  }
}

export function getCreneauSettings(): CreneauSettings {
  try {
    const raw = readLocal(scopedKey())
    if (!raw) return { ...DEFAULTS, crowdReports: [] }
    const parsed = JSON.parse(raw) as Partial<CreneauSettings>
    const reports = Array.isArray(parsed.crowdReports)
      ? parsed.crowdReports.map(sanitizeReport).filter((r): r is CrowdReport => !!r).slice(-200)
      : []
    return {
      favorite: sanitizeGym(parsed.favorite),
      backup: sanitizeGym(parsed.backup),
      trajetMode:
        parsed.trajetMode === 'velo' ||
        parsed.trajetMode === 'transports' ||
        parsed.trajetMode === 'voiture'
          ? parsed.trajetMode
          : 'pied',
      lockerMin:
        typeof parsed.lockerMin === 'number' && parsed.lockerMin > 0
          ? Math.min(30, Math.round(parsed.lockerMin))
          : 10,
      eveningWalkEnabled: Boolean(parsed.eveningWalkEnabled),
      stafflessGymEnabled: Boolean(parsed.stafflessGymEnabled),
      preferQuiet: parsed.preferQuiet !== false,
      heatVigilanceToday: Boolean(parsed.heatVigilanceToday),
      crowdReports: reports,
    }
  } catch {
    return { ...DEFAULTS, crowdReports: [] }
  }
}

export function saveCreneauSettings(patch: Partial<CreneauSettings>): CreneauSettings {
  const cur = getCreneauSettings()
  const next: CreneauSettings = {
    ...cur,
    ...patch,
    favorite:
      patch.favorite === undefined ? cur.favorite : sanitizeGym(patch.favorite),
    backup: patch.backup === undefined ? cur.backup : sanitizeGym(patch.backup),
  }
  writeLocal(scopedKey(), JSON.stringify(next))
  notify()
  return next
}

function localPersonId(): string {
  const uid = getActiveCloudUserId()
  if (uid) return `u:${uid}`
  try {
    const key = 'ranked-gym:creneau-person'
    let id = localStorage.getItem(key)
    if (!id) {
      id = `local:${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem(key, id)
    }
    return id
  } catch {
    return 'local:anon'
  }
}

export function recordCrowdTap(
  gymId: string,
  level: CreneauCrowdLevel,
  atMs = Date.now(),
  personId?: string,
): CreneauSettings {
  const cur = getCreneauSettings()
  const crowdReports = [
    ...cur.crowdReports,
    { gymId, level, atMs, personId: personId ?? localPersonId() },
  ].slice(-200)
  return saveCreneauSettings({ crowdReports })
}

export function clearCreneauSettings(): void {
  removeLocal(scopedKey())
  notify()
}

/** Seed demo salles once — Salle de la gare @ Tergnier (B2 / Vérificateur). */
export function ensureDefaultGyms(): CreneauSettings {
  const cur = getCreneauSettings()
  if (cur.favorite && cur.backup) {
    // Backfill coords if missing on favorite
    if (
      cur.favorite &&
      (cur.favorite.latitude == null || cur.favorite.longitude == null)
    ) {
      return saveCreneauSettings({
        favorite: {
          ...cur.favorite,
          city: cur.favorite.city ?? TERGNIER_COORDS.name,
          latitude: TERGNIER_COORDS.latitude,
          longitude: TERGNIER_COORDS.longitude,
        },
      })
    }
    return cur
  }
  return saveCreneauSettings({
    favorite: cur.favorite ?? {
      id: 'fav-gare',
      name: 'Salle de la gare',
      travelFromWorkMin: 15,
      travelFromHomeMin: 20,
      staffFromHm: '07:00',
      staffUntilHm: '22:00',
      closesHm: '23:00',
      city: TERGNIER_COORDS.name,
      latitude: TERGNIER_COORDS.latitude,
      longitude: TERGNIER_COORDS.longitude,
    },
    backup: cur.backup ?? {
      id: 'bk-republique',
      name: 'Salle République',
      travelFromWorkMin: 25,
      travelFromHomeMin: 10,
      staffFromHm: '08:00',
      staffUntilHm: '21:00',
      closesHm: '22:00',
      city: TERGNIER_COORDS.name,
      latitude: TERGNIER_COORDS.latitude,
      longitude: TERGNIER_COORDS.longitude,
    },
  })
}
