import { describe, expect, it } from 'vitest'
import {
  applyOneShotOffset,
  buildArmedWakes,
  computeWakeHm,
  computeWeekDebt,
  copyWeekTemplate,
  decompressionCopy,
  effectiveWakeForDay,
  emptyDayPlan,
  isMinorAge,
  canUseNightMode,
  shouldAutoPause,
  suggestedBedtimeHm,
  totalSleepMinutes,
  vacationResumeKey,
  waterDayKeyWakeToWake,
  weekTemplateForDate,
  defaultHvSettings,
} from './engine'
import { HV_MAX_ARMED_ALARMS, HV_MINOR_ADULT_HELP } from './constants'
import {
  HV_IMPOSED_PHRASES,
  HV_LEGACY_NAME,
  containsForbiddenHvCopy,
  minorGuidancePhrases,
  shortNightDriveLine,
} from './phrases'

describe('HV wake = start − trajet − préparation', () => {
  it('8:00 − 75 − 30 → 6:15', () => {
    expect(computeWakeHm('08:00', 75, 30)).toBe('06:15')
  })

  it('wraps past midnight', () => {
    // 01:00 − 90 − 30 = 23:00 (veille)
    expect(computeWakeHm('01:00', 90, 30)).toBe('23:00')
  })
})

describe('HV one-shot offset (ce jour seulement)', () => {
  it('+30 min', () => {
    expect(applyOneShotOffset('11:15', 30)).toBe('11:45')
  })
  it('Pas de réveil via noAlarm', () => {
    const day = { ...emptyDayPlan('2026-11-17'), startHm: '14:00', noAlarm: true }
    expect(effectiveWakeForDay(day, 75, 30)).toBeNull()
  })
})

describe('HV sieste comptée', () => {
  it('nuit 4h30 + sieste 2h30 = 7h', () => {
    const total = totalSleepMinutes([
      { startMin: 30, endMin: 300, kind: 'nuit' },
      { startMin: 13 * 60, endMin: 15 * 60 + 30, kind: 'sieste' },
    ])
    expect(total).toBe(7 * 60)
  })
})

describe('HV pause auto 7 jours', () => {
  it('triggers after 7 days without start', () => {
    const settings = {
      ...defaultHvSettings(),
      enabled: true,
      activatedAt: '2026-11-01T12:00:00.000Z',
      lastStartEditAt: null,
    }
    expect(
      shouldAutoPause({
        settings,
        hasAnyStart: false,
        now: new Date('2026-11-09T12:00:00.000Z'),
      }),
    ).toBe(true)
  })

  it('does not trigger if a start exists', () => {
    const settings = {
      ...defaultHvSettings(),
      enabled: true,
      activatedAt: '2026-11-01T12:00:00.000Z',
    }
    expect(
      shouldAutoPause({
        settings,
        hasAnyStart: true,
        now: new Date('2026-11-20T12:00:00.000Z'),
      }),
    ).toBe(false)
  })
})

describe('HV pause vacances', () => {
  it('resume = day after until', () => {
    expect(vacationResumeKey('2026-11-29')).toBe('2026-11-30')
  })
})

describe('HV journée d’eau lever→lever', () => {
  it('stays on last wake date until next wake', () => {
    const last = '2026-11-15T13:00:00.000Z'
    const key = waterDayKeyWakeToWake({
      now: new Date('2026-11-15T22:00:00.000Z'),
      lastWakeAt: last,
      nextWakeAt: '2026-11-16T13:00:00.000Z',
    })
    expect(key).toMatch(/2026-11-15/)
  })
})

describe('HV mineurs', () => {
  it('13–17 = minor, no night mode', () => {
    expect(isMinorAge(16)).toBe(true)
    expect(canUseNightMode(16)).toBe(false)
    expect(canUseNightMode(18)).toBe(true)
  })

  it('exact adult-help phrase', () => {
    expect(minorGuidancePhrases().adultHelp).toBe(HV_MINOR_ADULT_HELP)
    expect(minorGuidancePhrases().adultHelp).toBe(
      "Une question sur tes horaires ? Un adulte de confiance peut t'aider.",
    )
    expect(minorGuidancePhrases().adultHelp.toLowerCase()).not.toContain('médecin')
  })
})

describe('HV mots interdits', () => {
  it('rejects forbidden vocabulary', () => {
    expect(containsForbiddenHvCopy('ton score')).toBe(true)
    expect(containsForbiddenHvCopy('Au réveil')).toBe(true)
    expect(containsForbiddenHvCopy('voir un médecin')).toBe(true)
    expect(containsForbiddenHvCopy(HV_LEGACY_NAME)).toBe(true)
    expect(containsForbiddenHvCopy('Emploi du temps variable')).toBe(false)
  })

  it('imposed phrases are clean', () => {
    for (const p of HV_IMPOSED_PHRASES) {
      expect(containsForbiddenHvCopy(p)).toBe(false)
    }
    expect(shortNightDriveLine()).toContain('évite de prendre le volant')
  })
})

describe('HV décompression + dette', () => {
  it('coucher conseillé', () => {
    expect(suggestedBedtimeHm('23:00', 60)).toBe('00:00')
    expect(decompressionCopy('23:00', 60)).toContain('coucher conseillé vers')
  })

  it('week debt grey math', () => {
    const d = computeWeekDebt({
      tibHours: [5, 4.5, 7, 3.5, 5, 9, 7],
      referenceHours: 7,
    })
    expect(d.manqueHours).toBeCloseTo(10, 5)
    expect(d.recupereHours).toBeCloseTo(2, 5)
  })
})

describe('HV A/B arm cap', () => {
  it('arms at most HV_MAX_ARMED_ALARMS (14)', () => {
    const days = Array.from({ length: 20 }, (_, i) => {
      const d = emptyDayPlan(`2026-11-${String(16 + i).padStart(2, '0')}`)
      // keep valid keys in november then december — simplify with Date
      return d
    })
    // Build 20 consecutive days with starts
    const base = new Date(2026, 10, 16)
    const planned = Array.from({ length: 20 }, (_, i) => {
      const dt = new Date(base)
      dt.setDate(base.getDate() + i)
      const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      return {
        ...emptyDayPlan(key),
        kind: 'tot' as const,
        startHm: '08:00',
      }
    })
    const armed = buildArmedWakes({
      days: planned,
      trajetMin: 75,
      prepMin: 30,
      fromDateKey: planned[0].dateKey,
    })
    expect(armed.length).toBe(HV_MAX_ARMED_ALARMS)
    expect(armed[0].wakeHm).toBe('06:15')
    void days
  })

  it('week template A/B parity', () => {
    expect(weekTemplateForDate('2026-11-16', '2026-11-09')).toBe('B')
    expect(weekTemplateForDate('2026-11-09', '2026-11-09')).toBe('A')
  })

  it('copyWeekTemplate maps weekdays', () => {
    const src = [
      { ...emptyDayPlan('2026-11-09'), kind: 'tot' as const, startHm: '08:00' },
      { ...emptyDayPlan('2026-11-10'), kind: 'soir' as const, startHm: '14:00' },
    ]
    const copied = copyWeekTemplate(src, '2026-11-23')
    expect(copied[0].dateKey).toBe('2026-11-23')
    expect(copied[0].startHm).toBe('08:00')
    expect(copied[1].startHm).toBe('14:00')
  })
})
