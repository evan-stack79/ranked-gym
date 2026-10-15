/**
 * Filtre insultes avis bêta — pure (partagé client / serveur).
 * Masquage uniquement, jamais bloquant pour la détresse.
 */

export const AVIS_MOTS_BLESSANTS = [
  'connard',
  'connasse',
  'salope',
  'pute',
  'enculé',
  'encule',
  'pd',
  'fdp',
  'ntm',
  'nique',
  'niquer',
  'putain',
  'merde',
  'connerie',
] as const

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeInsultHaystack(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\u2018\u2019\u201A\u201B`´]/g, "'")
    .toLowerCase()
}

export function detectInsultWords(texte: string): string[] {
  const normalized = normalizeInsultHaystack(texte)
  const hits: string[] = []
  for (const word of AVIS_MOTS_BLESSANTS) {
    const needle = normalizeInsultHaystack(word)
    const pattern = new RegExp(`(?:^|[^\\p{L}\\p{N}])${escapeRegex(needle)}(?:[^\\p{L}\\p{N}]|$)`, 'u')
    if (pattern.test(normalized)) hits.push(word)
  }
  return hits
}

export function maskInsultWords(texte: string, insults: string[] = detectInsultWords(texte)): string {
  if (insults.length === 0) return texte
  let result = texte
  for (const word of insults) {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(word)}(?![\\p{L}\\p{N}])`, 'giu')
    result = result.replace(pattern, '•••')
  }
  return result
}
