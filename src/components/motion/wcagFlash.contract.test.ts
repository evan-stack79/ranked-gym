import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * WCAG 2.2 SC 2.3.1 — Three Flashes or Below Threshold.
 * Nothing may flash more than 3 times in any one second.
 * Sparks included; slow play-button breathe (2×) is allowed.
 */

const MIN_FLASH_PERIOD_MS = 1000 / 3 // 333.333… → require ≥ 334ms

const animCss = readFileSync(join(process.cwd(), 'src/components/motion/animations.css'), 'utf8')
const indexCss = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

function parseMsToken(css: string, token: string): number {
  const re = new RegExp(`${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\s*([\\d.]+)ms`)
  const m = css.match(re)
  expect(m, `missing duration token ${token}`).toBeTruthy()
  return Number(m![1])
}

function keyframeBlock(css: string, name: string): string {
  const re = new RegExp(`@keyframes\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`)
  const m = css.match(re)
  expect(m, `missing @keyframes ${name}`).toBeTruthy()
  return m![1]
}

/** Count hard opacity peaks (0→visible→0) that could read as flashes. */
function opacityPeakCount(block: string): number {
  const opacities = [...block.matchAll(/opacity:\s*([\d.]+)/g)].map((m) => Number(m[1]))
  let peaks = 0
  for (let i = 1; i < opacities.length - 1; i++) {
    if (opacities[i]! > opacities[i - 1]! && opacities[i]! > opacities[i + 1]!) peaks++
  }
  // Single rise-then-fall with only 3 stops still counts as one flash.
  if (peaks === 0 && opacities.length >= 2) {
    const max = Math.max(...opacities)
    const first = opacities[0]!
    const last = opacities[opacities.length - 1]!
    if (max > first && max > last) peaks = 1
  }
  return peaks
}

describe('WCAG 2.2 SC 2.3.1 — spark / glow flash budget', () => {
  it('spark duration tokens are ≥ 334ms (≤ 3 flashes/sec) and UI motion ≤ 600ms', () => {
    expect(parseMsToken(animCss, '--rg-session-spark-dur')).toBeGreaterThanOrEqual(MIN_FLASH_PERIOD_MS)
    expect(parseMsToken(animCss, '--rg-progress-spark-dur')).toBeGreaterThanOrEqual(MIN_FLASH_PERIOD_MS)
    expect(parseMsToken(animCss, '--rg-set-pop-dur')).toBeGreaterThanOrEqual(MIN_FLASH_PERIOD_MS)
    for (const token of [
      '--rg-session-circle-dur',
      '--rg-session-check-dur',
      '--rg-set-pop-dur',
      '--rg-tab-fade-dur',
      '--rg-card-expand-dur',
      '--rg-wave-card-dur',
      '--rg-progress-fill-dur',
    ] as const) {
      expect(parseMsToken(animCss, token), token).toBeLessThanOrEqual(600)
    }
    // Play breathe is the allowed exception (slow, 2 cycles).
    expect(parseMsToken(animCss, '--rg-play-breathe-dur')).toBeGreaterThanOrEqual(500)
  })

  it('session + progress spark keyframes are single-peak play-once (not a strobe)', () => {
    for (const name of ['rg-session-spark', 'rg-progress-spark', 'rg-set-row-flash'] as const) {
      const block = keyframeBlock(animCss, name)
      expect(opacityPeakCount(block)).toBeLessThanOrEqual(1)
      // Must not loop forever via the keyframe itself.
      expect(block).not.toMatch(/infinite/)
    }
    expect(animCss).toMatch(
      /\.rg-session-burst__spark[\s\S]*?animation-iteration-count:\s*1/,
    )
    expect(animCss).toMatch(
      /\.rg-living-progress__spark[\s\S]*?animation-iteration-count:\s*1/,
    )
    expect(animCss).toMatch(/\.rg-set-row--pop[\s\S]*?animation-iteration-count:\s*1/)
  })

  it('play-button breathe is slow (≥500ms) and only 2 iterations', () => {
    expect(parseMsToken(animCss, '--rg-play-breathe-dur')).toBeGreaterThanOrEqual(500)
    expect(animCss).toMatch(/--rg-play-breathe-count:\s*2/)
    expect(animCss).toMatch(
      /\.rg-play-breathe[\s\S]*?var\(--rg-play-breathe-count\)/,
    )
    const breathe = keyframeBlock(animCss, 'rg-play-glow-breathe')
    // Soft box-shadow pulse — not opacity strobing.
    expect(breathe).toMatch(/box-shadow/)
    expect(opacityPeakCount(breathe)).toBe(0)
  })

  it('streak celeb flash is a single short pulse, not a repeating strobe', () => {
    expect(indexCss).toMatch(
      /animation:\s*streak-celeb-flash\s+180ms[\s\S]*?\bboth\b/,
    )
    expect(indexCss).not.toMatch(/streak-celeb-flash[^;]*infinite/)
    const flash = keyframeBlock(indexCss, 'streak-celeb-flash')
    expect(opacityPeakCount(flash)).toBeLessThanOrEqual(1)
  })

  it('restyle tokens expose accent + durations (no hard-coded yellow colors)', () => {
    expect(animCss).toMatch(/--rg-anim-accent:\s*#ff2b2b/i)
    // Strip comments before scanning for forbidden yellow color tokens.
    const code = animCss.replace(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toMatch(/#ffc[\da-f]{3}\b|#ff0\b|#ffd60a\b|#ffcc00\b|#ffc928\b/i)
    expect(code).not.toMatch(/color:\s*yellow\b|background:\s*yellow\b/i)
    expect(animCss).toMatch(/--rg-session-spark-dur/)
    expect(animCss).toMatch(/--rg-progress-spark-dur/)
    expect(animCss).toMatch(/--rg-play-breathe-dur/)
  })
})
