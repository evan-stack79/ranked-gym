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

/** Retire les chiffres de fin et ne garde que les lettres (ex. Evanl141 → Evanl). */
function cleanUsernameToken(raw: string): string {
  const firstWord = raw.trim().split(/\s+/)[0] ?? ''
  const withoutTrailingDigits = firstWord.replace(/\d+$/, '')
  const lettersOnly = withoutTrailingDigits.replace(/[^\p{L}]/gu, '')
  return lettersOnly
}

/** Prénom affiché sur l'accueil (metadata > displayName propre > pseudo nettoyé). */
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
