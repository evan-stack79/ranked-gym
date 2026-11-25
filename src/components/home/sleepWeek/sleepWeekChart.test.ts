import { describe, expect, it } from 'vitest'
import {
  barHeightPx,
  chartSlotKind,
  formatBarDurationLabel,
  nightsSurSeptLabel,
  SLEEP_WEEK_CHART_H_PX,
  SLEEP_WEEK_CHART_MAX_MIN,
} from './sleepWeekChart'

describe('sleepWeekChart', () => {
  it('empty / null night → stub, never a 0 bar; future → empty', () => {
    expect(chartSlotKind(null)).toBe('stub')
    expect(chartSlotKind(undefined)).toBe('stub')
    expect(chartSlotKind(0)).toBe('stub')
    expect(chartSlotKind(470)).toBe('bar')
    expect(chartSlotKind(null, { future: true })).toBe('empty')
    expect(chartSlotKind(470, { future: true })).toBe('empty')
    expect(chartSlotKind(null, { emptyUnrecorded: true })).toBe('empty')
  })

  it('bar height scales to 10 h max; stub path never uses height 0 as a bar', () => {
    expect(barHeightPx(SLEEP_WEEK_CHART_MAX_MIN)).toBe(SLEEP_WEEK_CHART_H_PX)
    expect(barHeightPx(5 * 60)).toBe(SLEEP_WEEK_CHART_H_PX / 2)
    expect(chartSlotKind(0)).toBe('stub')
  })

  it('N nuits sur 7 label', () => {
    expect(nightsSurSeptLabel(0)).toBe('par nuit · 0 nuit sur 7')
    expect(nightsSurSeptLabel(1)).toBe('par nuit · 1 nuit sur 7')
    expect(nightsSurSeptLabel(3)).toBe('par nuit · 3 nuits sur 7')
    expect(nightsSurSeptLabel(7)).toBe('par nuit · 7 nuits sur 7')
  })

  it('bar duration label', () => {
    expect(formatBarDurationLabel(470)).toBe('7 h 50')
    expect(formatBarDurationLabel(460)).toBe('7 h 40')
  })
})
