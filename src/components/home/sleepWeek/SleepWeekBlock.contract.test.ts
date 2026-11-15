import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('SleepWeekBlock bars-v2 contract (maquette apres.html)', () => {
  const src = readFileSync(resolve(__dirname, 'SleepWeekBlock.tsx'), 'utf8')

  it('uses bar chart (no SVG curve / glow / stars / provisoire)', () => {
    expect(src).toMatch(/data-sleep-week-variant="bars-v2"/)
    expect(src).toMatch(/data-sleep-week-bar/)
    expect(src).toMatch(/data-sleep-week-stub/)
    expect(src).toMatch(/nightsSurSeptLabel/)
    expect(src).toMatch(/chartSlotKind/)
    expect(src).not.toMatch(/provisoire/)
    expect(src).not.toMatch(/monotonePath|sleepWeekFill|data-sleep-week-curve/)
    expect(src).not.toMatch(/✦|drop-shadow|linearGradient/)
    expect(src).not.toMatch(/flamme|streak|BPM|kcal|score|%/i)
  })

  it('day circles: sel / has / no + legend + 24pt heads', () => {
    expect(src).toMatch(/data-sleep-week-day-state/)
    expect(src).toMatch(/data-sleep-week-legend/)
    expect(src).toMatch(/Nuit notée/)
    expect(src).toMatch(/Pas de nuit/)
    expect(src).toMatch(/Ton repère/)
    expect(src).toMatch(/h-6 w-6/)
    expect(src).toMatch(/#ff0702/)
    expect(src).toMatch(/SLEEP_WEEK_BAR_RECORDED|SLEEP_WEEK_BAR_SELECTED/)
  })

  it('chart constants keep recorded bar dark red #6e1a18', () => {
    const chart = readFileSync(resolve(__dirname, 'sleepWeekChart.ts'), 'utf8')
    expect(chart).toMatch(/#6e1a18/)
    expect(chart).toMatch(/#ff0702/)
  })
})
