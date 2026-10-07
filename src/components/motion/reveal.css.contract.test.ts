import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

describe('reveal / blur-in / press CSS contract', () => {
  it('settled blur-in clears filter, opacity, and transform on words', () => {
    expect(css).toMatch(/\.rg-blur-in--settled[\s\S]*?\.rg-blur-word[\s\S]*?filter:\s*none/)
    expect(css).toMatch(/\.rg-blur-in--settled[\s\S]*?\.rg-blur-word[\s\S]*?opacity:\s*1/)
    expect(css).toMatch(/\.rg-blur-in--settled[\s\S]*?\.rg-blur-word[\s\S]*?transform:\s*none/)
  })

  it('title words use blur(8px) + translateY(4px)', () => {
    expect(css).toMatch(/\.rg-blur-word[\s\S]*?filter:\s*blur\(8px\)/)
    expect(css).toMatch(/\.rg-blur-word[\s\S]*?translate3d\(0,\s*4px,\s*0\)/)
    expect(css).toMatch(/rg-blur-word-in\s+var\(--dur-word\)\s+var\(--ease-out\)/)
  })

  it('cards rise with translateY(12px)', () => {
    expect(css).toMatch(/\.rg-reveal[\s\S]*?translate3d\(0,\s*12px,\s*0\)/)
    expect(css).toMatch(/rg-reveal-in\s+var\(--dur-reveal\)\s+var\(--ease-out\)/)
  })

  it('button press uses ~120ms ease-out and scale(0.96)', () => {
    expect(css).toMatch(/--dur-press:\s*120ms/)
    expect(css).toMatch(/\.ios-press:active[\s\S]*?scale\(0\.96\)/)
    expect(css).toMatch(/transform\s+var\(--dur-press\)\s+var\(--ease-out\)/)
  })

  it('prefers-reduced-motion forces visible settled styles', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rg-blur-word[\s\S]*?filter:\s*none\s*!important/,
    )
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rg-reveal[\s\S]*?opacity:\s*1\s*!important/,
    )
  })

  it('distress screens disable motion', () => {
    expect(css).toMatch(/\[data-distress-level='1'\]/)
    expect(css).toMatch(/\[data-distress-level='2'\]/)
    expect(css).toMatch(
      /\[data-distress-level='1'\][\s\S]*?animation:\s*none\s*!important/,
    )
  })

  it('uses short reveal duration and ease-out token', () => {
    expect(css).toMatch(/--dur-reveal:\s*400ms/)
    expect(css).toMatch(/--dur-word:\s*400ms/)
  })
})
