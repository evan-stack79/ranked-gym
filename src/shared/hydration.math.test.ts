import { describe, expect, it } from 'vitest'
import {
  CLASSIC_BOTTLE_ML,
  GLASS_ML,
  GOAL_DEFAULT_ML,
  GOAL_MAX_ML,
  GOAL_MIN_ML,
  HIGH_INFO_THRESHOLD_ML,
  LABEL_EAU_BUE_SEULE,
} from '../../shared/hydration/constants'
import {
  containerVolumeMl,
  dayKeyOffsetFromServer,
  fillRatio,
  formatLitersFr,
  isDayKeyWithinTolerance,
  isReminderTimeAllowed,
  isValidGoalMl,
  lastNDayKeys,
  quickAddAmountMl,
  remainingMl,
  showHighInfo,
} from '../../shared/hydration/math'

describe('hydration constants §9', () => {
  it('C-HY1/2/3 + HY-15 + 2L figés', () => {
    expect(GOAL_DEFAULT_ML).toBe(1500)
    expect(GOAL_MIN_ML).toBe(1000)
    expect(GOAL_MAX_ML).toBe(3000)
    expect(HIGH_INFO_THRESHOLD_ML).toBe(3000)
    expect(GLASS_ML).toBe(250)
    expect(CLASSIC_BOTTLE_ML).toBe(2000)
    expect(LABEL_EAU_BUE_SEULE).toBe('Eau bue seule')
  })
})

describe('hydration math', () => {
  it('remaining / fillRatio (dessin se vide)', () => {
    expect(remainingMl(1500, 700)).toBe(800)
    expect(fillRatio(1500, 0)).toBe(1)
    expect(fillRatio(1500, 1500)).toBe(0)
    expect(fillRatio(1500, 750)).toBe(0.5)
  })

  it('showHighInfo dès 3000', () => {
    expect(showHighInfo(2999)).toBe(false)
    expect(showHighInfo(3000)).toBe(true)
  })

  it('quick adds', () => {
    expect(quickAddAmountMl('glass', 'classic_2l', null)).toBe(250)
    expect(quickAddAmountMl('half_bottle', 'classic_2l', null)).toBe(1000)
    expect(quickAddAmountMl('full_bottle', 'classic_2l', null)).toBe(2000)
    expect(quickAddAmountMl('half_bottle', 'my_bottle', 750)).toBe(375)
    expect(containerVolumeMl('glasses_250', null)).toBe(250)
    expect(containerVolumeMl('classic_15', null)).toBe(1500)
    expect(quickAddAmountMl('full_bottle', 'classic_15', null)).toBe(1500)
    expect(quickAddAmountMl('half_bottle', 'classic_15', null)).toBe(750)
  })

  it('goal bounds', () => {
    expect(isValidGoalMl(1000)).toBe(true)
    expect(isValidGoalMl(3000)).toBe(true)
    expect(isValidGoalMl(999)).toBe(false)
    expect(isValidGoalMl(3001)).toBe(false)
    expect(isValidGoalMl(1500.5)).toBe(false)
  })

  it('reminders never night 21–08', () => {
    expect(isReminderTimeAllowed('10:00')).toBe(true)
    expect(isReminderTimeAllowed('14:00')).toBe(true)
    expect(isReminderTimeAllowed('18:00')).toBe(true)
    expect(isReminderTimeAllowed('08:00')).toBe(true)
    expect(isReminderTimeAllowed('20:59')).toBe(true)
    expect(isReminderTimeAllowed('21:00')).toBe(false)
    expect(isReminderTimeAllowed('23:00')).toBe(false)
    expect(isReminderTimeAllowed('07:59')).toBe(false)
  })

  it('dayKey tolerance ±1', () => {
    const now = Date.parse('2026-11-08T12:00:00.000Z')
    expect(isDayKeyWithinTolerance('2026-11-08', now)).toBe(true)
    expect(isDayKeyWithinTolerance('2026-11-07', now)).toBe(true)
    expect(isDayKeyWithinTolerance('2026-11-09', now)).toBe(true)
    expect(isDayKeyWithinTolerance('2026-11-06', now)).toBe(false)
    expect(dayKeyOffsetFromServer('2026-11-08', now)).toBe(0)
  })

  it('history keys 7d', () => {
    expect(lastNDayKeys('2026-11-08', 7)).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-07',
      '2026-11-08',
    ])
  })

  it('format FR', () => {
    expect(formatLitersFr(800)).toBe('0,8 L')
    expect(formatLitersFr(2000)).toBe('2 L')
  })
})
