// Moteur des maquettes : calculs partie A + 12 états partie B + priorité partie C de SCIENCE_12_ETATS.md.
// Sert seulement à produire des chiffres d'exemple cohérents. Ce n'est pas du code de l'app.

export type SleepEngineNight = {
  day: string
  bed: string
  wake: string
  R: number
}

export type SleepEtatQ = {
  sieste?: { min: number; jours: number; debut: number }
  nuitsLongues?: string
  coupDeBarre?: boolean
  fatigue?: string
  [key: string]: unknown
}

const hm = (s: string): number => {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
const mod = (a: number, n: number): number => ((a % n) + n) % n
const median = (a: number[]): number => {
  const s = [...a].sort((x, y) => x - y)
  const n = s.length
  return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2
}
const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length
const sd = (a: number[]): number => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1))
}
const r5 = (m: number): number => Math.round(m / 5) * 5

export const FREE = new Set(['ven', 'sam']) // nuits du vendredi et du samedi (défaut, partie A)

export function besoin(age: number): [number, number] {
  // tableau A, valeurs app, en minutes
  if (age <= 18) return [480, 600]
  if (age <= 64) return [420, 540]
  return [420, 480]
}

export function stats(nights: SleepEngineNight[]) {
  const all = nights
    .map((n) => ({ ...n, b: hm(n.bed), w: hm(n.wake) }))
    .map((n) => ({ ...n, dur: mod(n.w - n.b, 1440), bp: mod(n.b - 720, 1440) }))
  const valid = all.filter((n) => n.dur >= 120 && n.dur <= 960) // sinon « Tu confirmes ? »
  const durs = valid.map((n) => n.dur)
  const wk = valid.filter((n) => !FREE.has(n.day))
  const we = valid.filter((n) => FREE.has(n.day))
  const ms = (n: (typeof valid)[number]) => n.bp + n.dur / 2
  const Dsem = wk.length ? mean(wk.map((n) => n.dur)) : null
  const Dwe = we.length ? mean(we.map((n) => n.dur)) : null
  const R = mean(valid.map((n) => n.R))
  return {
    n: valid.length,
    nWk: wk.length,
    nWe: we.length,
    Draw: mean(durs),
    D: r5(mean(durs)),
    Cmed: mod(median(valid.map((n) => n.bp)) + 720, 1440),
    CmedP: median(valid.map((n) => n.bp)),
    Lmed: median(valid.map((n) => n.w)),
    sigC: r5(sd(valid.map((n) => n.bp))),
    sigW: r5(sd(valid.map((n) => n.w))),
    SJL:
      wk.length && we.length
        ? r5(Math.abs(median(we.map(ms)) - median(wk.map(ms))))
        : null,
    Dsem,
    Dwe,
    diffWe: Dsem != null && Dwe != null ? r5(Dwe - Dsem) : null,
    R,
    Rhalf: Math.round(R * 2) / 2,
    anyR1: valid.some((n) => n.R === 1),
  }
}

export type SleepEtatResult = {
  id: number
  s: ReturnType<typeof stats>
  Bb?: number
  Bh?: number
}

// q : réponses aux questions rapides (Q) ; age en années.
export function etat(
  nights: SleepEngineNight[],
  age: number,
  q: SleepEtatQ = {},
): SleepEtatResult {
  const s = stats(nights)
  if (s.n < 5) return { id: 0, s } // 0. moins de 5 nuits valides
  const [Bb, Bh] = besoin(age)
  const D = s.D
  const R = s.R
  const d = Bb - D
  const inRange = D >= Bb && D <= Bh
  const t: Array<[number, boolean]> = [
    [
      6,
      s.nWk >= 3 &&
        s.nWe >= 1 &&
        ((s.Dwe! - s.Dsem!) >= 120 || (s.SJL ?? 0) >= 120) &&
        s.Dsem! < Bb,
    ],
    [8, s.sigC > 90 || s.sigW > 90],
    [
      10,
      D < 360 &&
        !!q.sieste &&
        q.sieste.min >= 60 &&
        q.sieste.jours >= 3 &&
        q.sieste.debut >= 900,
    ],
    [9, inRange && R <= 2 && q.nuitsLongues === '3+'],
    [5, (age >= 65 ? D >= 540 : D >= 600) && R <= 2],
    [3, D < 360 && R >= 4],
    [1, (age <= 18 ? D < 420 : D < 390) && R <= 3],
    [7, s.Cmed >= 90 && s.Cmed <= 360 && inRange && s.sigC <= 90],
    [
      11,
      D >= 420 &&
        D < 480 &&
        ((age >= 13 && age <= 18) || ((age === 19 || age === 20) && R <= 3)),
    ],
    [4, age >= 19 && d > 0 && d <= 30 && (R <= 3 || q.coupDeBarre === true)],
    [2, D > Bh && R >= 3 && !(q.fatigue === 'journee' && R <= 2)],
    [
      12,
      inRange &&
        s.sigC < 45 &&
        (s.diffWe ?? 0) < 120 &&
        s.CmedP < mod(90 - 720, 1440) &&
        R >= 4 &&
        !s.anyR1,
    ],
  ]
  const hit = t.find(([, ok]) => ok)
  return { id: hit ? hit[0]! : 13, s, Bb, Bh } // 13 = aucun état
}

export const fmtDur = (m: number): string => {
  m = Math.round(m)
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r}\u00a0min`
  return r
    ? `${h}\u00a0h\u00a0${String(r).padStart(2, '0')}`
    : `${h}\u00a0h`
}

export const fmtClock = (m: number): string => {
  m = mod(Math.round(m), 1440)
  const h = Math.floor(m / 60)
  const r = m % 60
  return `${h}\u00a0h\u00a0${String(r).padStart(2, '0')}`
}
