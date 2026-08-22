export interface ResolveDisplayFirstNameInput {
  firstName?: string | null
  displayName?: string | null
  pseudo?: string | null
}

function capitalizeWord(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

function looksLikeCleanName(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  return !/\d/.test(trimmed) && /^[\p{L}\s'-]+$/u.test(trimmed)
}

/**
 * Nettoie un pseudo gaming : Evanl141 → Evan, Paul141 → Paul, Evan141 → Evan.
 */
function cleanUsernameToken(raw: string): string {
  const firstWord = raw.trim().split(/\s+/)[0] ?? ''
  if (!firstWord) return ''

  // Lettre parasite avant chiffres finaux (ex. Evanl141)
  const bridged = firstWord.match(/^([\p{Lu}][\p{Ll}]{3,})[\p{Ll}]\d+$/u)
  if (bridged?.[1]) return bridged[1]

  // Chiffres directement après le nom (ex. Paul141, Evan141)
  const direct = firstWord.match(/^([\p{Lu}][\p{Ll}]+)\d+$/u)
  if (direct?.[1]) return direct[1]

  const withoutTrailingDigits = firstWord.replace(/\d+$/, '')
  return withoutTrailingDigits.replace(/[^\p{L}]/gu, '')
}

/** Prénom affiché sur l'accueil (first_name metadata > displayName propre > pseudo nettoyé). */
export function resolveDisplayFirstName(input: ResolveDisplayFirstNameInput): string {
  const metaFirst = input.firstName?.trim()
  if (metaFirst && looksLikeCleanName(metaFirst)) {
    return capitalizeWord(metaFirst.split(/\s+/)[0])
  }

  const display = input.displayName?.trim()
  if (display && looksLikeCleanName(display)) {
    return capitalizeWord(display.split(/\s+/)[0])
  }

  const raw = input.pseudo?.trim() || display || ''
  if (!raw) return 'Champion'

  const cleaned = cleanUsernameToken(raw)
  if (!cleaned) return 'Champion'
  return capitalizeWord(cleaned)
}

/** Message d'accueil dynamique selon l'heure et le prénom. */
export function getHomeGreeting(firstName: string, now = new Date()): string {
  const hour = now.getHours()
  const name = firstName || 'Champion'

  if (hour >= 5 && hour < 12) return `Prêt à rank up, ${name} ?`
  if (hour >= 12 && hour < 17) return `Séance de l'après-midi, ${name} ?`
  if (hour >= 17 && hour < 22) return `Séance du soir, ${name} ?`
  return `Recovery mode, ${name} ?`
}
