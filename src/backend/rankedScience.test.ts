import { describe, expect, it } from 'vitest'
import {
  absoluteCapKg,
  classifyAnomaly,
  disciplinePointsForNewSession,
  disciplineSessionPoints,
  estimateEpley1RmKg,
  evaluateSubmitLift,
  exceedsAbsoluteCap,
  forceScoreFromBreakdown,
  publicRankedMethod,
  relativeCapCheck,
  resolveAnomalyBaseline,
  softResetSeedScore,
} from '../../convex/lib/rankedScience'
import {
  assertRankedAdultAge,
  assertRankedNotPregnantOrBreastfeeding,
  RANKED_REFUSED_AGE_UNKNOWN,
  RANKED_REFUSED_BREASTFEEDING,
  RANKED_REFUSED_MINOR,
  RANKED_REFUSED_PREGNANCY,
} from '../../convex/lib/rankedAccess'

describe('RF-1RM-01 Epley', () => {
  it('r=1 → 1RM = w', () => {
    expect(estimateEpley1RmKg(100, 1)).toBe(100)
  })

  it('r=2..10 → w×(1+r/30)', () => {
    for (let r = 2; r <= 10; r += 1) {
      expect(estimateEpley1RmKg(100, r)).toBeCloseTo(100 * (1 + r / 30), 10)
    }
    expect(estimateEpley1RmKg(100, 10)).toBeCloseTo(100 * (1 + 10 / 30), 10)
  })

  it('r=11 → hors Force (null)', () => {
    expect(estimateEpley1RmKg(100, 11)).toBeNull()
  })
})

describe('RF-CAP-01 plafonds H/F/unknown', () => {
  it('plafonds absolus H/F', () => {
    expect(absoluteCapKg('squat', 'M')).toBe(515)
    expect(absoluteCapKg('squat', 'F')).toBe(340)
    expect(absoluteCapKg('bench', 'M')).toBe(375)
    expect(absoluteCapKg('bench', 'F')).toBe(220)
    expect(absoluteCapKg('deadlift', 'M')).toBe(520)
    expect(absoluteCapKg('deadlift', 'F')).toBe(315)
  })

  it('sexe unknown → plafond H', () => {
    expect(absoluteCapKg('squat', 'unknown')).toBe(515)
    expect(exceedsAbsoluteCap('squat', 516, 'unknown')).toBe(true)
    expect(exceedsAbsoluteCap('squat', 515, 'unknown')).toBe(false)
    expect(exceedsAbsoluteCap('squat', 341, 'F')).toBe(true)
  })
})

describe('RF-CAP-01b row ≤ dl / OHP ≤ bench', () => {
  it('row ≤ deadlift Vérifié', () => {
    expect(relativeCapCheck('barbell_row', 180, { deadlift: 200 }).ok).toBe(true)
    expect(relativeCapCheck('barbell_row', 201, { deadlift: 200 }).ok).toBe(false)
    expect(relativeCapCheck('barbell_row', 100, {}).ok).toBe(false)
  })

  it('OHP ≤ bench Vérifié', () => {
    expect(relativeCapCheck('ohp', 100, { bench: 120 }).ok).toBe(true)
    expect(relativeCapCheck('ohp', 121, { bench: 120 }).ok).toBe(false)
    expect(relativeCapCheck('ohp', 80, {}).ok).toBe(false)
  })

  it('seuils provisoires → file relecture', () => {
    expect(relativeCapCheck('barbell_row', 251, { deadlift: 300 }).needsReviewQueue).toBe(true)
    expect(relativeCapCheck('ohp', 181, { bench: 200 }).needsReviewQueue).toBe(true)
  })
})

describe('RF-ANOM-01 A/B/novice', () => {
  const day = 24 * 60 * 60 * 1000

  it('>15% ≤7j → A ; >25% → B', () => {
    expect(
      classifyAnomaly({
        previous1RmKg: 100,
        next1RmKg: 116,
        deltaWithinMs: 2 * day,
        historySpanMs: 20 * 7 * day,
      }),
    ).toBe('A')
    expect(
      classifyAnomaly({
        previous1RmKg: 100,
        next1RmKg: 126,
        deltaWithinMs: 2 * day,
        historySpanMs: 20 * 7 * day,
      }),
    ).toBe('B')
  })

  it('novice <8 sem : 25%/40%', () => {
    expect(
      classifyAnomaly({
        previous1RmKg: 100,
        next1RmKg: 120,
        deltaWithinMs: 2 * day,
        historySpanMs: 4 * 7 * day,
      }),
    ).toBe('none')
    expect(
      classifyAnomaly({
        previous1RmKg: 100,
        next1RmKg: 130,
        deltaWithinMs: 2 * day,
        historySpanMs: 4 * 7 * day,
      }),
    ).toBe('A')
    expect(
      classifyAnomaly({
        previous1RmKg: 100,
        next1RmKg: 141,
        deltaWithinMs: 2 * day,
        historySpanMs: 4 * 7 * day,
      }),
    ).toBe('B')
  })
})

describe('B2 / M4 baseline anomalies', () => {
  const now = 1_000_000_000_000

  it('repro A : rejected 200 ignoré → baseline peak pending 100 → ressaisie 200 = B', () => {
    const baseline = resolveAnomalyBaseline({
      verified1RmKg: null,
      verifiedAtMs: null,
      recentLifts: [
        { estimated1RmKg: 100, createdAt: now - 60_000, status: 'pending_verify' },
        { estimated1RmKg: 200, createdAt: now - 30_000, status: 'rejected_force' },
      ],
      nowMs: now,
    })
    expect(baseline.baseline1RmKg).toBe(100)
    const r = evaluateSubmitLift({
      canonicalExerciseId: 'bench',
      weightKg: 200,
      reps: 1,
      sex: 'M',
      verifiedRefs: {},
      baseline1RmKg: baseline.baseline1RmKg,
      baselineAtMs: baseline.baselineAtMs,
      historyFirstAtMs: now - 60_000,
      nowMs: now,
    })
    expect(r.status).toBe('rejected_force')
    expect(r.anomalyFlag).toBe('B')
  })

  it('M4 : échauffement 50 kg ne doit pas faire refuser un vrai 100 kg vérifié', () => {
    const baseline = resolveAnomalyBaseline({
      verified1RmKg: 100,
      verifiedAtMs: now - 2 * 24 * 60 * 60 * 1000,
      recentLifts: [
        { estimated1RmKg: 50, createdAt: now - 60_000, status: 'pending_verify' },
        { estimated1RmKg: 50, createdAt: now - 30_000, status: 'declared' },
      ],
      nowMs: now,
    })
    expect(baseline.baseline1RmKg).toBe(100)
    const r = evaluateSubmitLift({
      canonicalExerciseId: 'bench',
      weightKg: 100,
      reps: 1,
      sex: 'M',
      verifiedRefs: {},
      baseline1RmKg: baseline.baseline1RmKg,
      baselineAtMs: baseline.baselineAtMs,
      historyFirstAtMs: now - 2 * 24 * 60 * 60 * 1000,
      nowMs: now,
    })
    expect(r.anomalyFlag).toBe('none')
    expect(r.status).toBe('pending_verify')
  })
})

describe('B1-bis friend code', () => {
  it('normalise et valide le format', async () => {
    const { normalizeFriendCode, isValidFriendCodeFormat, deriveFriendCodeCandidate } =
      await import('../../convex/lib/rankedScience')
    expect(normalizeFriendCode(' ab-cd_12 ')).toBe('ABCD12')
    const code = deriveFriendCodeCandidate('user-xyz', 0)
    expect(code).toHaveLength(8)
    expect(isValidFriendCodeFormat(code)).toBe(true)
    expect(isValidFriendCodeFormat('SHORT')).toBe(false)
  })
})

describe('B4 soft reset seed', () => {
  it('re-placement partiel 50 %, pas 100 %', () => {
    expect(softResetSeedScore(420)).toBe(210)
    expect(softResetSeedScore(0)).toBe(0)
  })
})

describe('RF-DISC-01 6e séance = 0 pt', () => {
  it('plafonne à 5', () => {
    expect(disciplineSessionPoints(5)).toBe(5)
    expect(disciplineSessionPoints(6)).toBe(5)
    expect(disciplineSessionPoints(7)).toBe(5)
  })

  it('6e séance n’ajoute aucun point', () => {
    expect(disciplinePointsForNewSession(0)).toBe(1)
    expect(disciplinePointsForNewSession(4)).toBe(1)
    expect(disciplinePointsForNewSession(5)).toBe(0)
    expect(disciplinePointsForNewSession(6)).toBe(0)
  })
})

describe('CA1 opt-in mineur / âge inconnu / grossesse', () => {
  it('mineur refus', () => {
    expect(assertRankedAdultAge({ age: 17 })).toEqual({
      ok: false,
      error: RANKED_REFUSED_MINOR,
    })
  })

  it('âge inconnu refus', () => {
    expect(assertRankedAdultAge({})).toEqual({
      ok: false,
      error: RANKED_REFUSED_AGE_UNKNOWN,
    })
    expect(assertRankedAdultAge(null)).toEqual({
      ok: false,
      error: RANKED_REFUSED_AGE_UNKNOWN,
    })
  })

  it('18+ ok', () => {
    expect(assertRankedAdultAge({ age: 18 })).toEqual({ ok: true, age: 18 })
  })

  it('grossesse / allaitement refus compétitif', () => {
    expect(assertRankedNotPregnantOrBreastfeeding({ declaredPregnancy: true })).toEqual({
      ok: false,
      error: RANKED_REFUSED_PREGNANCY,
    })
    expect(assertRankedNotPregnantOrBreastfeeding({ declaredBreastfeeding: true })).toEqual({
      ok: false,
      error: RANKED_REFUSED_BREASTFEEDING,
    })
  })
})

describe('evaluateSubmitLift + pondération égale', () => {
  it('r>10 → declared only', () => {
    const r = evaluateSubmitLift({
      canonicalExerciseId: 'squat',
      weightKg: 100,
      reps: 11,
      sex: 'M',
      verifiedRefs: {},
      previous1RmKg: null,
      previousAtMs: null,
      historyFirstAtMs: null,
      nowMs: Date.now(),
    })
    expect(r.status).toBe('declared')
    expect(r.estimated1RmKg).toBeNull()
  })

  it('plafond → rejected_force', () => {
    const r = evaluateSubmitLift({
      canonicalExerciseId: 'bench',
      weightKg: 400,
      reps: 1,
      sex: 'M',
      verifiedRefs: {},
      previous1RmKg: null,
      previousAtMs: null,
      historyFirstAtMs: null,
      nowMs: Date.now(),
    })
    expect(r.status).toBe('rejected_force')
    expect(r.reason).toBe('absolute_cap')
  })

  it('score Force = somme égale des 5', () => {
    expect(
      forceScoreFromBreakdown({
        squat: 100,
        bench: 80,
        deadlift: 120,
        barbell_row: 70,
        ohp: 50,
      }),
    ).toBe(420)
  })
})

describe('CA5 méthode publique', () => {
  it('expose barème sans auth', () => {
    const m = publicRankedMethod()
    expect(m.epley.formula).toContain('1 + r/30')
    expect(m.forceWeighting).toBe('equal_5')
    expect(m.gymLeaderboard).toMatch(/P0-bis/)
    expect(m.never).toContain('bodyweight_display')
    expect(m.never).toContain('iap_on_rank')
  })
})
