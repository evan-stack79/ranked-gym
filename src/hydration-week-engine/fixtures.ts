/**
 * Synthetic weeks that hit each état id 1–10 and priority conflicts.
 * Volumes in litres ; hours local clock.
 */

import type { HydrationDay, HydrationEtatInput } from './engine.ts'

function day(
  dayIndex: number,
  entries: HydrationDay['entries'],
  extra: Partial<HydrationDay> = {},
): HydrationDay {
  return { dayIndex, entries, ...extra }
}

function glasses(
  kind: string,
  volumeL: number,
  hours: number[],
): HydrationDay['entries'] {
  return hours.map((hour) => ({ hour, volumeL, kind }))
}

/** Baseline: 4–7 saisi days of ~1.5 L eau, no tip triggers. */
function quietDays(n = 5): HydrationDay[] {
  return Array.from({ length: n }, (_, i) =>
    day(i, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 13, volumeL: 0.5, kind: 'eau' },
      { hour: 17, volumeL: 0.5, kind: 'eau' },
    ]),
  )
}

/** État 1 — V < 1 L on ≥3 days + Q toilettes. */
export const FIXTURE_ETAT_1: HydrationEtatInput = {
  age: 30,
  sex: 'female',
  q: { toilettes: true },
  days: [
    day(0, glasses('eau', 0.25, [9, 14, 18])), // 0.75 L
    day(1, glasses('eau', 0.25, [10, 15, 19])), // 0.75 L
    day(2, glasses('eau', 0.3, [9, 16])), // 0.6 L
    day(3, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 14, volumeL: 0.5, kind: 'eau' },
      { hour: 18, volumeL: 0.5, kind: 'eau' },
    ]),
    day(4, [
      { hour: 8, volumeL: 0.5, kind: 'eau' },
      { hour: 12, volumeL: 0.5, kind: 'eau' },
      { hour: 17, volumeL: 0.5, kind: 'eau' },
    ]),
  ],
}

/** État 2 — 65+, V < 1 L or Vtot < 1.6 on ≥4 days. */
export const FIXTURE_ETAT_2: HydrationEtatInput = {
  age: 70,
  sex: 'homme',
  days: [
    day(0, glasses('eau', 0.3, [9, 14])), // 0.6
    day(1, glasses('eau', 0.25, [10, 15, 18])), // 0.75
    day(2, [
      { hour: 9, volumeL: 0.4, kind: 'eau' },
      { hour: 14, volumeL: 0.4, kind: 'cafe' },
    ]), // V=0.4, Vtot=0.8
    day(3, glasses('eau', 0.3, [9, 13])), // 0.6
    day(4, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 15, volumeL: 0.5, kind: 'eau' },
      { hour: 19, volumeL: 0.5, kind: 'eau' },
    ]),
  ],
}

/** État 3 — 0 saisie / module masqué. */
export const FIXTURE_ETAT_3: HydrationEtatInput = {
  age: 28,
  sex: 'female',
  moduleHidden: false,
  days: [
    day(0, []),
    day(1, []),
    day(2, []),
    day(3, []),
    day(4, []),
    day(5, []),
    day(6, []),
  ],
}

export const FIXTURE_ETAT_3_HIDDEN: HydrationEtatInput = {
  age: 28,
  sex: 'female',
  moduleHidden: true,
  days: quietDays(5),
}

/** État 4 — pause choisie. */
export const FIXTURE_ETAT_4: HydrationEtatInput = {
  age: 32,
  sex: 'male',
  q: { pauseComptage: true },
  days: quietDays(5),
}

/** État 4 via médiane ≥12 saisies + Q. */
export const FIXTURE_ETAT_4_COUNTING: HydrationEtatInput = {
  age: 32,
  sex: 'male',
  q: { comptagePesant: true },
  days: Array.from({ length: 4 }, (_, i) =>
    day(
      i,
      Array.from({ length: 14 }, (__, j) => ({
        hour: 8 + (j % 10),
        volumeL: 0.1,
        kind: 'eau',
      })),
    ),
  ),
}

/** État 5 — V ≥ 3 L on ≥2 days. */
export const FIXTURE_ETAT_5: HydrationEtatInput = {
  age: 35,
  sex: 'female',
  days: [
    day(0, [
      { hour: 8, volumeL: 1.0, kind: 'eau' },
      { hour: 12, volumeL: 1.0, kind: 'eau' },
      { hour: 16, volumeL: 1.0, kind: 'eau' },
      { hour: 20, volumeL: 0.5, kind: 'eau' },
    ]), // 3.5 L
    day(1, [
      { hour: 9, volumeL: 1.5, kind: 'eau' },
      { hour: 14, volumeL: 1.5, kind: 'eau' },
    ]), // 3.0 L
    day(2, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 13, volumeL: 0.5, kind: 'eau' },
      { hour: 18, volumeL: 0.5, kind: 'eau' },
    ]),
    day(3, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 14, volumeL: 0.5, kind: 'eau' },
      { hour: 17, volumeL: 0.5, kind: 'eau' },
    ]),
  ],
}

/**
 * Priority conflict: état 5 + low-V days that would otherwise suggest « boire plus »
 * (état 1 / 9). État 5 must win and block drink-more.
 */
export const FIXTURE_PRIORITY_5_BLOCKS_DRINK_MORE: HydrationEtatInput = {
  age: 40,
  sex: 'male',
  q: { toilettes: true, eauPlatePasTonTruc: true },
  days: [
    day(0, [
      { hour: 8, volumeL: 1.2, kind: 'eau' },
      { hour: 12, volumeL: 1.2, kind: 'eau' },
      { hour: 18, volumeL: 1.0, kind: 'eau' },
    ]), // 3.4 L → état 5
    day(1, [
      { hour: 9, volumeL: 1.5, kind: 'eau' },
      { hour: 15, volumeL: 1.5, kind: 'eau' },
    ]), // 3.0 L
    day(2, glasses('eau', 0.2, [9, 14, 18])), // 0.6 L low
    day(3, glasses('eau', 0.25, [10, 16])), // 0.5 L low
    day(4, glasses('eau', 0.3, [9, 13])), // 0.6 L low
  ],
}

/** État 6 — evening catch-up ≥3 days (no sport after 17h). */
export const FIXTURE_ETAT_6: HydrationEtatInput = {
  age: 29,
  sex: 'female',
  days: [
    day(
      0,
      [
        { hour: 10, volumeL: 0.2, kind: 'eau' },
        { hour: 20, volumeL: 0.6, kind: 'eau' },
        { hour: 21, volumeL: 0.5, kind: 'eau' },
      ],
      { bedtimeHour: 23 },
    ), // evening 1.1 / total 1.3 ≥ 60%
    day(
      1,
      [
        { hour: 11, volumeL: 0.3, kind: 'eau' },
        { hour: 19.5, volumeL: 0.7, kind: 'eau' },
        { hour: 21, volumeL: 0.5, kind: 'eau' },
      ],
      { bedtimeHour: 23 },
    ),
    day(
      2,
      [
        { hour: 9, volumeL: 0.2, kind: 'eau' },
        { hour: 20, volumeL: 1.0, kind: 'eau' },
      ],
      { bedtimeHour: 23 },
    ),
    day(3, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 13, volumeL: 0.5, kind: 'eau' },
      { hour: 17, volumeL: 0.5, kind: 'eau' },
    ]),
  ],
}

/** État 7 adult — ≥50% sugary/caffeinated on ≥4 days. */
export const FIXTURE_ETAT_7_ADULT: HydrationEtatInput = {
  age: 28,
  sex: 'male',
  days: [
    day(0, [
      { hour: 9, volumeL: 0.3, kind: 'cafe' },
      { hour: 12, volumeL: 0.3, kind: 'soda' },
      { hour: 16, volumeL: 0.2, kind: 'eau' },
    ]),
    day(1, [
      { hour: 9, volumeL: 0.4, kind: 'cafe' },
      { hour: 14, volumeL: 0.4, kind: 'jus' },
      { hour: 18, volumeL: 0.2, kind: 'eau' },
    ]),
    day(2, [
      { hour: 10, volumeL: 0.5, kind: 'boisson_energetique' },
      { hour: 15, volumeL: 0.3, kind: 'soda' },
      { hour: 19, volumeL: 0.2, kind: 'eau' },
    ]),
    day(3, [
      { hour: 9, volumeL: 0.35, kind: 'the' },
      { hour: 13, volumeL: 0.35, kind: 'cola' },
      { hour: 17, volumeL: 0.2, kind: 'eau' },
    ]),
    day(4, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 14, volumeL: 0.5, kind: 'eau' },
      { hour: 18, volumeL: 0.5, kind: 'eau' },
    ]),
  ],
}

/** État 7 minor — same pattern, age < 18. */
export const FIXTURE_ETAT_7_MINOR: HydrationEtatInput = {
  ...FIXTURE_ETAT_7_ADULT,
  age: 15,
  sex: 'femme',
}

/** État 7 via ≥5 caffeinated drinks in a day. */
export const FIXTURE_ETAT_7_FIVE_COFFEES: HydrationEtatInput = {
  age: 40,
  sex: 'male',
  days: [
    day(0, [
      { hour: 8, volumeL: 0.2, kind: 'cafe' },
      { hour: 10, volumeL: 0.2, kind: 'cafe' },
      { hour: 12, volumeL: 0.2, kind: 'cafe' },
      { hour: 15, volumeL: 0.2, kind: 'cafe' },
      { hour: 17, volumeL: 0.2, kind: 'cafe' },
      { hour: 19, volumeL: 0.3, kind: 'eau' },
    ]),
    ...quietDays(4).map((d, i) => ({ ...d, dayIndex: i + 1 })),
  ],
}

/** État 8 — day card: long sport + V ≤ median non-sport + Q. */
export const FIXTURE_ETAT_8: HydrationEtatInput = {
  age: 27,
  sex: 'male',
  q: { chaudOuTranspire: true },
  days: [
    day(0, [
      { hour: 9, volumeL: 0.6, kind: 'eau' },
      { hour: 14, volumeL: 0.6, kind: 'eau' },
      { hour: 18, volumeL: 0.5, kind: 'eau' },
    ]), // 1.7 non-sport
    day(1, [
      { hour: 9, volumeL: 0.5, kind: 'eau' },
      { hour: 13, volumeL: 0.5, kind: 'eau' },
      { hour: 17, volumeL: 0.5, kind: 'eau' },
    ]), // 1.5
    day(2, [
      { hour: 9, volumeL: 0.55, kind: 'eau' },
      { hour: 14, volumeL: 0.55, kind: 'eau' },
      { hour: 18, volumeL: 0.5, kind: 'eau' },
    ]), // 1.6
    day(
      3,
      [
        { hour: 9, volumeL: 0.4, kind: 'eau' },
        { hour: 14, volumeL: 0.4, kind: 'eau' },
      ],
      { sports: [{ startHour: 18, durationMin: 90 }] },
    ), // 0.8 ≤ median ~1.6
  ],
}

/** État 9 — Q eau plate + low V days. */
export const FIXTURE_ETAT_9: HydrationEtatInput = {
  age: 24,
  sex: 'female',
  q: { eauPlatePasTonTruc: true },
  days: [
    day(0, glasses('eau', 0.25, [9, 14, 18])),
    day(1, glasses('eau', 0.3, [10, 15])),
    day(2, glasses('eau', 0.2, [9, 13, 17])),
    day(3, glasses('eau', 0.25, [11, 16])),
  ],
}

/** État 10 — médiane ≥6 saisies jours 1–3, puis ≥2 jours sans saisie. */
export const FIXTURE_ETAT_10: HydrationEtatInput = {
  age: 22,
  sex: 'male',
  daysWithoutEntry: 2,
  days: [
    day(
      0,
      Array.from({ length: 7 }, (_, j) => ({
        hour: 8 + j,
        volumeL: 0.2,
        kind: 'eau',
      })),
    ),
    day(
      1,
      Array.from({ length: 6 }, (_, j) => ({
        hour: 9 + j,
        volumeL: 0.2,
        kind: 'eau',
      })),
    ),
    day(
      2,
      Array.from({ length: 8 }, (_, j) => ({
        hour: 8 + j,
        volumeL: 0.15,
        kind: 'eau',
      })),
    ),
    day(3, []),
    day(4, []),
    day(5, []),
    day(6, []),
  ],
}

/** Après 14 jours sans saisie → état 3 (plus 10). */
export const FIXTURE_ETAT_10_TO_3: HydrationEtatInput = {
  ...FIXTURE_ETAT_10,
  daysWithoutEntry: 14,
  days: [
    day(0, []),
    day(1, []),
    day(2, []),
    day(3, []),
    day(4, []),
    day(5, []),
    day(6, []),
  ],
}

/** &lt;4 days saisi → no week tip (unless 3/10). */
export const FIXTURE_TOO_FEW_DAYS: HydrationEtatInput = {
  age: 30,
  sex: 'female',
  q: { toilettes: true, eauPlatePasTonTruc: true },
  days: [
    day(0, glasses('eau', 0.2, [9, 14])),
    day(1, glasses('eau', 0.2, [10, 15])),
    day(2, glasses('eau', 0.2, [11, 16])),
  ],
}

/** 7-minor beats 2 when both could apply — use young senior? Actually 2 needs 65+.
 * Conflict: 7-minor vs 6 — minor with evening catch-up + sugary pattern.
 */
export const FIXTURE_PRIORITY_7_MINOR_OVER_6: HydrationEtatInput = {
  age: 16,
  sex: 'femme',
  days: [
    day(
      0,
      [
        { hour: 10, volumeL: 0.2, kind: 'soda' },
        { hour: 20, volumeL: 0.6, kind: 'soda' },
        { hour: 21, volumeL: 0.5, kind: 'jus' },
      ],
      { bedtimeHour: 23 },
    ),
    day(
      1,
      [
        { hour: 11, volumeL: 0.2, kind: 'cafe' },
        { hour: 19.5, volumeL: 0.7, kind: 'soda' },
        { hour: 21, volumeL: 0.5, kind: 'cola' },
      ],
      { bedtimeHour: 23 },
    ),
    day(
      2,
      [
        { hour: 9, volumeL: 0.2, kind: 'soda' },
        { hour: 20, volumeL: 1.0, kind: 'jus' },
      ],
      { bedtimeHour: 23 },
    ),
    day(3, [
      { hour: 9, volumeL: 0.4, kind: 'soda' },
      { hour: 13, volumeL: 0.4, kind: 'cafe' },
      { hour: 17, volumeL: 0.2, kind: 'eau' },
    ]),
  ],
}

export const ALL_ETAT_FIXTURES: Record<number, HydrationEtatInput> = {
  1: FIXTURE_ETAT_1,
  2: FIXTURE_ETAT_2,
  3: FIXTURE_ETAT_3,
  4: FIXTURE_ETAT_4,
  5: FIXTURE_ETAT_5,
  6: FIXTURE_ETAT_6,
  7: FIXTURE_ETAT_7_ADULT,
  8: FIXTURE_ETAT_8,
  9: FIXTURE_ETAT_9,
  10: FIXTURE_ETAT_10,
}
