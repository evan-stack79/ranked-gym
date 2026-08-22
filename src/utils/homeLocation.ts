import { getActiveCheckIn, getLastLocationLabel } from '../services/lobbyStorage'

function extractCityFromLabel(label: string): string {
  const trimmed = label.trim()
  if (!trimmed) return ''
  const beforeComma = trimmed.split(',')[0]?.trim()
  if (beforeComma && beforeComma.length <= 40) return beforeComma
  return trimmed
}

function extractCityFromAddress(address: string): string {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2]
    if (candidate && !/^\d/.test(candidate)) return candidate
  }
  return extractCityFromLabel(address)
}

/** Ville ou zone affichée sur le feed social de l'accueil. */
export function resolveHomeAreaName(): string {
  const checkIn = getActiveCheckIn()
  if (checkIn?.gym?.address) {
    const city = extractCityFromAddress(checkIn.gym.address)
    if (city) return city
  }

  const last = getLastLocationLabel()
  if (last?.label) {
    const city = extractCityFromLabel(last.label)
    if (city) return city
  }

  return 'Tergnier'
}
