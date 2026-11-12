import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('SleepClockDial v12 C visual contract', () => {
  const src = readFileSync('src/components/home/SleepClockDial.tsx', 'utf8')

  it('uses v12 C geometry constants and butt-cap night arc', () => {
    expect(src).toMatch(/const SW = 26/)
    expect(src).toMatch(/const ARC_W = 20/)
    expect(src).toMatch(/const HS = 36/)
    expect(src).toMatch(/C - HS \/ 2 - 10/)
    expect(src).toMatch(/strokeLinecap="butt"/)
    expect(src).toMatch(/#ff0702/)
    expect(src).toMatch(/data-sleep-dial-variant="v12c"/)
    expect(src).toMatch(/length: 48/)
    expect(src).not.toMatch(/gradient|glow|feGaussianBlur/i)
  })
})
