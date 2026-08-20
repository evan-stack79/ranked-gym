/** Portion without a scale: count pieces from the pack label. */

export type PieceInputMode = 'pack' | 'typical'

export type PieceFoodKind =
  | 'nugget'
  | 'meatball'
  | 'croquette'
  | 'finger'
  | 'wing'
  | 'dumpling'
  | 'cookie'
  | 'generic'

/** Typical cooked / ready-to-eat grams per piece (FR retail averages). */
export const TYPICAL_GRAMS_PER_PIECE: Record<PieceFoodKind, number> = {
  nugget: 18,
  meatball: 22,
  croquette: 25,
  finger: 28,
  wing: 35,
  dumpling: 20,
  cookie: 12,
  generic: 20,
}

export const PIECE_KIND_LABELS: Record<PieceFoodKind, string> = {
  nugget: 'Nuggets',
  meatball: 'Boulettes',
  croquette: 'Croquettes',
  finger: 'Fingers / sticks',
  wing: 'Wings',
  dumpling: 'Raviolis / gyoza',
  cookie: 'Biscuits',
  generic: 'Pièces',
}

export function detectPieceKind(productName: string): PieceFoodKind {
  const n = productName.toLowerCase()
  if (/nugget|chicken\s*bite|poulet\s*pan[eé]/.test(n)) return 'nugget'
  if (/boulette|meatball|boule\s*de\s*viande|kefta/.test(n)) return 'meatball'
  if (/croquette/.test(n)) return 'croquette'
  if (/finger|stick|goujon|tenders?/.test(n)) return 'finger'
  if (/wing|aile/.test(n)) return 'wing'
  if (/ravioli|gyoza|dumpling|wan\s*tan|wonton/.test(n)) return 'dumpling'
  if (/cookie|biscuit|sabl[eé]/.test(n)) return 'cookie'
  return 'generic'
}

export function gramsFromPack(input: {
  packGrams: number
  packPieces: number
  eatenPieces: number
}): number | null {
  const { packGrams, packPieces, eatenPieces } = input
  if (
    !(packGrams > 0) ||
    !(packPieces > 0) ||
    !(eatenPieces > 0) ||
    !Number.isFinite(packGrams) ||
    !Number.isFinite(packPieces) ||
    !Number.isFinite(eatenPieces)
  ) {
    return null
  }
  const perPiece = packGrams / packPieces
  const total = perPiece * eatenPieces
  return Math.round(total * 100) / 100
}

export function gramsFromTypical(kind: PieceFoodKind, eatenPieces: number): number | null {
  if (!(eatenPieces > 0) || !Number.isFinite(eatenPieces)) return null
  const total = TYPICAL_GRAMS_PER_PIECE[kind] * eatenPieces
  return Math.round(total * 100) / 100
}

export function formatPieceSummary(eaten: number, grams: number, kind: PieceFoodKind): string {
  const label = PIECE_KIND_LABELS[kind].toLowerCase()
  return `${eaten} ${label} · ~${grams} g`
}

const PRESET_KEY = 'ranked-gym:piece-presets'

type PackPreset = { packGrams: number; packPieces: number }

export function loadPackPreset(barcode: string): PackPreset | null {
  try {
    const raw = localStorage.getItem(PRESET_KEY)
    if (!raw) return null
    const all = JSON.parse(raw) as Record<string, PackPreset>
    return all[barcode] ?? null
  } catch {
    return null
  }
}

export function savePackPreset(barcode: string, preset: PackPreset): void {
  try {
    const raw = localStorage.getItem(PRESET_KEY)
    const all = (raw ? JSON.parse(raw) : {}) as Record<string, PackPreset>
    all[barcode] = preset
    localStorage.setItem(PRESET_KEY, JSON.stringify(all))
  } catch {
    // ignore quota
  }
}
