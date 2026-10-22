/**
 * Parse des teneurs Ciqual (colonne Energie UE 1169 kcal/100 g).
 * Virgules FR ; « - », « traces », « < x » → absent (jamais 0 inventé).
 */

/** Code constituant Ciqual : Energie, Règlement UE N° 1169/2011 (kcal/100 g). */
export const CIQUAL_CONST_UE_KCAL_1169 = '328' as const

/**
 * Interprète une teneur brute Ciqual.
 * @returns nombre > 0, ou `null` si absent / non sûr (ne jamais renvoyer 0 pour vide).
 */
export function parseCiqualKcalTeneur(raw: string | null | undefined): number | null {
  if (raw == null) return null
  let s = String(raw).trim().toLowerCase().replace(/\u00a0/g, ' ')
  s = s.replace(/\s+/g, '')
  if (!s) return null
  if (s === '-' || s === '–' || s === '—' || s === 'na' || s === 'n/a' || s === '.') {
    return null
  }
  if (s.includes('trace')) return null
  if (s.startsWith('<') || s.startsWith('≤') || s.startsWith('<=')) return null
  s = s.replace(/,/g, '.')
  s = s.replace(/[^0-9.+-]/g, '')
  if (!s || s === '+' || s === '-' || s === '.' || s === '+.' || s === '-.') return null
  const value = Number(s)
  if (!Number.isFinite(value)) return null
  // 0 ou négatif = absent pour l’UI (871 aliments sans kcal ne doivent jamais afficher 0).
  if (!(value > 0) || value > 5000) return null
  return value
}
