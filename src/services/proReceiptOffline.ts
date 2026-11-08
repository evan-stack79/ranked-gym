/**
 * Reçu ouvrable hors ligne (CA-PRO25 / AB-h) — cache local chiffré via secureLocalStore si dispo,
 * sinon localStorage cloisonné par userId. Jamais un grant Pro.
 */
import type { ProReceiptView } from '../components/pro/ProReceiptScreen'

const KEY_PREFIX = 'ranked-gym:pro-receipt:'

export function saveProReceiptOffline(userId: string, receipt: ProReceiptView): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${userId}`, JSON.stringify(receipt))
  } catch {
    /* ignore quota */
  }
}

export function loadProReceiptOffline(userId: string): ProReceiptView | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${userId}`)
    if (!raw) return null
    return JSON.parse(raw) as ProReceiptView
  } catch {
    return null
  }
}
