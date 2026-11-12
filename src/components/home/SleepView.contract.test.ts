import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatDurationHoursLabel, formatFrenchLongDate } from '../../utils/sleepTimeFormat'
import { sleepSpanMinutes } from '../../utils/sleepDialMath'
import { computeTibHours } from '../../sleep-engine'

describe('SleepView v11 page contracts', () => {
  it('page exposes dial, cards, Dormir maintenant, diag', () => {
    const src = readFileSync(resolve(__dirname, 'SleepView.tsx'), 'utf8')
    expect(src).toMatch(/data-sleep-page/)
    expect(src).toMatch(/data-sleep-route="sommeil"/)
    expect(src).toMatch(/SleepClockDial/)
    expect(src).toMatch(/Dormir maintenant/)
    expect(src).toMatch(/SleepAlarmDiagBlock/)
    expect(src).toMatch(/Sonnerie/)
    expect(src).toMatch(/Répétition/)
    expect(src).not.toMatch(/Au réveil/)
    expect(src).not.toMatch(/flamme|streak|BPM|kcal/i)
  })

  it('wheel/dial persist window + reschedule AlarmKit on commit', () => {
    const src = readFileSync(resolve(__dirname, 'SleepView.tsx'), 'utf8')
    expect(src).toMatch(/onCommit=\{onDialCommit\}/)
    expect(src).toMatch(/rescheduleAlarmIfNeeded/)
    expect(src).toMatch(/syncSleepAlarm/)
    expect(src).toMatch(/SleepHmWheelSheet/)
  })

  it('durée cadran (minuit) → label « 8 h » / « 8 h 30 »', () => {
    expect(sleepSpanMinutes('23:00', '07:00')).toBe(8 * 60)
    expect(formatDurationHoursLabel(computeTibHours('23:00', '07:00')!)).toBe('8 h')
    expect(formatDurationHoursLabel(computeTibHours('23:00', '07:30')!)).toBe('8 h 30')
  })

  it('date FR capitalisée', () => {
    const label = formatFrenchLongDate(new Date('2026-11-12T12:00:00'))
    expect(label).toMatch(/12/)
    expect(label).toMatch(/novembre/i)
    expect(label[0]).toMatch(/\p{Lu}/u)
  })

  it('Sommeil page wires dial-bg + sleepy-moon + moon/sunrise icons (no week bars)', () => {
    const src = readFileSync(resolve(__dirname, 'SleepView.tsx'), 'utf8')
    expect(src).toMatch(/its-sleeptime/)
    expect(src).toMatch(/sleepy-moon/)
    expect(src).toMatch(/name="moon"/)
    expect(src).toMatch(/name="sunrise"/)
    expect(src).not.toMatch(/SleepWeekChart/)
  })
})
