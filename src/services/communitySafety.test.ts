import { describe, expect, it } from 'vitest'
import {
  FORBIDDEN_RANKING_AXES,
  isNotificationTemplateAllowed,
  isRankingEligible,
  neutralizeLevelRanking,
} from './communitySafety'
import { canParticipateInRankings } from './nutritionSafetyRules'

describe('Classements / notifications', () => {
  it('mineur et âge inconnu exclus du classement', () => {
    expect(canParticipateInRankings({ age: 17, weightKg: 60, heightCm: 170, sex: 'female' })).toBe(
      false,
    )
    expect(canParticipateInRankings({ age: 0, weightKg: 60, heightCm: 170, sex: 'female' })).toBe(
      false,
    )
    expect(canParticipateInRankings({ age: 25, weightKg: 60, heightCm: 170, sex: 'female' })).toBe(
      true,
    )
  })

  it('TCA déclaré → exclusion classement', () => {
    expect(
      canParticipateInRankings({
        age: 25,
        weightKg: 60,
        heightCm: 170,
        sex: 'female',
        declarations: { eatingDisorder: true },
      }),
    ).toBe(false)
  })

  it('Q11 : axes volume / séances / XP listés comme interdits', () => {
    expect(FORBIDDEN_RANKING_AXES).toEqual(
      expect.arrayContaining(['volume', 'session_count', 'xp_from_volume', 'level_from_xp']),
    )
  })

  it('neutralizeLevelRanking ne trie pas par niveau', () => {
    const members = [
      { username: 'Zoé', level: 99 },
      { username: 'Ada', level: 10 },
      { username: 'Mia', level: 50 },
    ]
    const sorted = neutralizeLevelRanking(members)
    expect(sorted.map((m) => m.username)).toEqual(['Ada', 'Mia', 'Zoé'])
  })

  it('notifications : refuse poids/calories ; session OK', () => {
    expect(
      isNotificationTemplateAllowed(
        { kind: 'session', title: 'Séance', body: 'Prépare ton entraînement' },
        {
          weightKg: 70,
          goalWeightKg: 70,
          heightCm: 170,
          age: 30,
          sex: 'male',
          activity: 'moderate',
          morphology: 'mesomorph',
          goal: 'maintain',
          weeklyPaceKg: 0,
          onboardingComplete: true,
        },
      ),
    ).toBe(true)

    expect(
      isNotificationTemplateAllowed({
        kind: 'other',
        title: 'Rappel',
        body: 'Tu as 500 kcal restantes',
      }),
    ).toBe(false)
  })

  it('isRankingEligible lit le profil local (âge 0 → false)', () => {
    // Sans profil stocké, BLANK_PROFILE.age = 0 → non éligible (protecteur).
    expect(isRankingEligible()).toBe(false)
  })
})
