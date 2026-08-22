/** Prénom affiché sur l'accueil (pseudo ou displayName). */
export function resolveDisplayFirstName(
  pseudo?: string | null,
  displayName?: string | null,
): string {
  const raw = pseudo?.trim() || displayName?.trim() || ''
  if (!raw) return 'Champion'
  const first = raw.split(/\s+/)[0]
  return first.charAt(0).toUpperCase() + first.slice(1)
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
