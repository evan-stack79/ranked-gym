import { describe, expect, it } from 'vitest'
import {
  applyOneShotOffset,
  bedMarginHours,
  buildArmedWakes,
  classifyDayKindFromStart,
  debtReferenceHours,
  defaultCycleWeeks,
  defaultHvSettings,
  defaultWeekSlots,
  effectiveWakeForDay,
  effectiveWakeInstant,
  emptyDayPlan,
  canUseNightMode,
  isMinorAge,
  materializeDaysFromTemplates,
  nextArmedWake,
  weekTemplateForDate,
  applyCycleModelToWeek,
} from './engine'
import {
  classifyStartKind,
  computeWakeInstant,
  cycleIndexForMonday,
  isQuickReturnAdult,
  restHoursBetween,
  shouldShowMinorRestCard,
  suggestedBedFromWake,
  HV_BED_MARGIN_ADULT_H,
  HV_BED_MARGIN_TEEN_H,
  HV_DEBT_R_ADULT_H,
  HV_DEBT_R_TEEN_H,
  HV_QUICK_RETURN_MAX_H,
} from './rules'

describe('SOLUTIONS_15 — exception vs semaine type', () => {
  it('skips exception days when materializing', () => {
    const settings = {
      ...defaultHvSettings(new Date('2026-11-16T12:00:00')),
      cycleLength: 1 as const,
      cycleWeeks: defaultCycleWeeks(1),
      weekASlots: defaultWeekSlots('08:00'),
      weekARefMondayKey: '2026-11-16',
    }
    const existing = [
      {
        ...emptyDayPlan('2026-11-17'),
        kind: 'tot' as const,
        startHm: '05:30',
        exception: true,
      },
    ]
    const days = materializeDaysFromTemplates({
      settings,
      existingDays: existing,
      fromDateKey: '2026-11-16',
      horizonDays: 7,
    })
    const tue = days.find((d) => d.dateKey === '2026-11-17')
    expect(tue?.startHm).toBe('05:30')
    expect(tue?.exception).toBe(true)
    const mon = days.find((d) => d.dateKey === '2026-11-16')
    expect(mon?.startHm).toBe('08:00')
    expect(mon?.exception).toBe(false)
  })
})

describe('SOLUTIONS_15 — trajet/prépa par jour', () => {
  it('uses day overrides for wake', () => {
    const day = {
      ...emptyDayPlan('2026-11-17'),
      kind: 'tot' as const,
      startHm: '08:00',
      trajetMin: 75,
      prepMin: 30,
    }
    // 08:00 − 75 − 30 = 06:15 (overrides beat settings 30/30)
    expect(effectiveWakeForDay(day, 30, 30)).toBe('06:15')
  })

  it('falls back to settings when day overrides null', () => {
    const day = {
      ...emptyDayPlan('2026-11-17'),
      kind: 'tot' as const,
      startHm: '08:00',
      trajetMin: null,
      prepMin: null,
    }
    expect(effectiveWakeForDay(day, 30, 30)).toBe('07:00')
  })
})

describe('SOLUTIONS_15 — postes 0:30 et 22:00 (vraie date)', () => {
  it('0:30 mardi − 60 min → réveil lundi 23:30', () => {
    const w = computeWakeInstant({
      startDateKey: '2026-11-17',
      startHm: '00:30',
      trajetMin: 30,
      prepMin: 30,
    })
    expect(w).not.toBeNull()
    expect(w!.wakeDateKey).toBe('2026-11-16')
    expect(w!.wakeHm).toBe('23:30')
    expect(w!.crossesMidnight).toBe(true)
  })

  it('22:00 − 60 min → réveil même jour 21:00', () => {
    const w = computeWakeInstant({
      startDateKey: '2026-11-17',
      startHm: '22:00',
      trajetMin: 30,
      prepMin: 30,
    })
    expect(w!.wakeDateKey).toBe('2026-11-17')
    expect(w!.wakeHm).toBe('21:00')
  })

  it('buildArmedWakes arms wake on previous calendar day', () => {
    const day = {
      ...emptyDayPlan('2026-11-17'),
      kind: 'nuit' as const,
      startHm: '00:30',
      trajetMin: 30,
      prepMin: 30,
    }
    const armed = buildArmedWakes({
      days: [day],
      trajetMin: 30,
      prepMin: 30,
      fromDateKey: '2026-11-16',
      now: new Date(2026, 10, 16, 12, 0, 0),
    })
    expect(armed[0]?.dateKey).toBe('2026-11-16')
    expect(armed[0]?.wakeHm).toBe('23:30')
  })
})

describe('SOLUTIONS_15 — 4:30 = Tôt (pas Nuit)', () => {
  it('4:30 → tot ; 3:59 → nuit ; 20:00 → nuit', () => {
    expect(classifyStartKind('04:30')).toBe('tot')
    expect(classifyDayKindFromStart('04:30')).toBe('tot')
    expect(classifyStartKind('03:59')).toBe('nuit')
    expect(classifyStartKind('20:00')).toBe('nuit')
    expect(classifyStartKind('08:00')).toBe('journee')
    expect(classifyStartKind('14:00')).toBe('soir')
  })

  it('mineur : pas de type Nuit', () => {
    expect(classifyStartKind('22:00', { isMinor: true })).toBe('soir')
    expect(classifyDayKindFromStart('00:30', { isMinor: true })).toBe('soir')
  })
})

describe('SOLUTIONS_15 — coucher −8 / −9', () => {
  it('adulte réveil 6:15 → coucher 22:15 (−8 h)', () => {
    expect(bedMarginHours(30)).toBe(HV_BED_MARGIN_ADULT_H)
    expect(HV_BED_MARGIN_ADULT_H).toBe(8)
    const bed = suggestedBedFromWake({
      wakeDateKey: '2026-11-17',
      wakeHm: '06:15',
      age: 30,
    })
    expect(bed?.bedHm).toBe('22:15')
    expect(bed?.bedDateKey).toBe('2026-11-16')
  })

  it('ado 13–18 réveil 7:00 → coucher 22:00 (−9 h)', () => {
    expect(bedMarginHours(16)).toBe(HV_BED_MARGIN_TEEN_H)
    expect(bedMarginHours(18)).toBe(9)
    expect(HV_BED_MARGIN_TEEN_H).toBe(9)
    const bed = suggestedBedFromWake({
      wakeDateKey: '2026-11-17',
      wakeHm: '07:00',
      age: 16,
    })
    expect(bed?.bedHm).toBe('22:00')
  })

  it('dette R = 7 adulte / 8 ado (pas marge coucher)', () => {
    expect(debtReferenceHours(30)).toBe(HV_DEBT_R_ADULT_H)
    expect(debtReferenceHours(16)).toBe(HV_DEBT_R_TEEN_H)
    expect(HV_DEBT_R_ADULT_H).toBe(7)
    expect(HV_DEBT_R_TEEN_H).toBe(8)
  })
})

describe('SOLUTIONS_15 — repos entre journées', () => {
  it('fin 23:00 → début 08:00 = 9 h → retour rapide (≤11)', () => {
    const r = restHoursBetween(
      { dateKey: '2026-11-16', hm: '23:00' },
      { dateKey: '2026-11-17', hm: '08:00' },
    )
    expect(r).toBe(9)
    expect(isQuickReturnAdult(r)).toBe(true)
    expect(HV_QUICK_RETURN_MAX_H).toBe(11)
  })

  it('repos 11 h pile = retour rapide', () => {
    expect(isQuickReturnAdult(11)).toBe(true)
    expect(isQuickReturnAdult(11.01)).toBe(false)
  })

  it('fin overnight 22:00 → 06:00 next', () => {
    const r = restHoursBetween(
      { dateKey: '2026-11-17', hm: '06:00' }, // finish landed next day
      { dateKey: '2026-11-17', hm: '22:00' },
    )
    expect(r).toBe(16)
    expect(isQuickReturnAdult(r)).toBe(false)
  })
})

describe('SOLUTIONS_15 — mineurs', () => {
  it('carte si repos < 12 h (16–17) ou < 14 h (<16)', () => {
    expect(shouldShowMinorRestCard(16, 11.9)).toBe(true)
    expect(shouldShowMinorRestCard(16, 12)).toBe(false)
    expect(shouldShowMinorRestCard(15, 13.9)).toBe(true)
    expect(shouldShowMinorRestCard(15, 14)).toBe(false)
    expect(shouldShowMinorRestCard(20, 5)).toBe(false)
  })

  it('silence si repos inconnu', () => {
    expect(shouldShowMinorRestCard(16, null)).toBe(false)
  })

  it('canUseNightMode ne dépend plus de l’âge', () => {
    expect(isMinorAge(16)).toBe(true)
    expect(canUseNightMode(16)).toBe(true)
    expect(canUseNightMode(13)).toBe(true)
    expect(canUseNightMode(30)).toBe(true)
  })
})

describe('SOLUTIONS_15 — cycle 1–4 semaines + lettre par lundi', () => {
  it('cycle index differs for this week vs next', () => {
    expect(cycleIndexForMonday('2026-11-16', '2026-11-09', 2)).toBe(1) // B
    expect(cycleIndexForMonday('2026-11-23', '2026-11-09', 2)).toBe(0) // A
    expect(weekTemplateForDate('2026-11-16', '2026-11-09', 2)).toBe('B')
    expect(weekTemplateForDate('2026-11-23', '2026-11-09', 2)).toBe('A')
  })

  it('3-week cycle A/B/C', () => {
    expect(weekTemplateForDate('2026-11-09', '2026-11-09', 3)).toBe('A')
    expect(weekTemplateForDate('2026-11-16', '2026-11-09', 3)).toBe('B')
    expect(weekTemplateForDate('2026-11-23', '2026-11-09', 3)).toBe('C')
    expect(weekTemplateForDate('2026-11-30', '2026-11-09', 3)).toBe('A')
  })

  it('applyCycleModelToWeek uses model not past days', () => {
    const slots = defaultWeekSlots('14:00')
    const week = applyCycleModelToWeek(slots, '2026-11-23')
    expect(week[0].startHm).toBe('14:00')
    expect(week[0].dateKey).toBe('2026-11-23')
  })
})

describe('SOLUTIONS_15 — pause = réveil simple (calc)', () => {
  it('nextArmedWake picks first future wake', () => {
    const wakes = [
      {
        dateKey: '2026-11-17',
        wakeHm: '06:15',
        wakeAt: new Date(2026, 10, 17, 6, 15),
      },
      {
        dateKey: '2026-11-18',
        wakeHm: '06:15',
        wakeAt: new Date(2026, 10, 18, 6, 15),
      },
    ]
    const next = nextArmedWake(wakes, new Date(2026, 10, 17, 3, 0))
    expect(next?.dateKey).toBe('2026-11-17')
    const later = nextArmedWake(wakes, new Date(2026, 10, 17, 8, 0))
    expect(later?.dateKey).toBe('2026-11-18')
  })

  it('one-shot offset still applies on wake', () => {
    expect(applyOneShotOffset('06:15', 30)).toBe('06:45')
  })

  it('effectiveWakeInstant crosses midnight for night shift', () => {
    const day = {
      ...emptyDayPlan('2026-11-17'),
      kind: 'nuit' as const,
      startHm: '00:30',
      trajetMin: 30,
      prepMin: 30,
    }
    const w = effectiveWakeInstant(day, 30, 30)
    expect(w?.wakeDateKey).toBe('2026-11-16')
    expect(w?.wakeHm).toBe('23:30')
    expect(w?.crossesMidnight).toBe(true)
  })
})
