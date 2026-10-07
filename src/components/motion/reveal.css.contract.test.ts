import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

describe('Evan motion CSS contract', () => {
  it('Blur In Up words use blur(10px) + translateY(12px)', () => {
    expect(css).toMatch(/\.rg-blur-word[\s\S]*?filter:\s*blur\(10px\)/)
    expect(css).toMatch(/\.rg-blur-word[\s\S]*?translate3d\(0,\s*12px,\s*0\)/)
    expect(css).toMatch(/rg-blur-in-up\s+var\(--rg-word-dur/)
  })

  it('Soft Blur In uses blur(4px) + translateY(4px) ~400ms', () => {
    expect(css).toMatch(/--dur-soft-blur:\s*400ms/)
    expect(css).toMatch(/\.rg-soft-blur[\s\S]*?filter:\s*blur\(4px\)/)
    expect(css).toMatch(/\.rg-soft-blur[\s\S]*?translate3d\(0,\s*4px,\s*0\)/)
  })

  it('Mask Reveal Up uses clip-path inset from 100% to 0', () => {
    expect(css).toMatch(/\.rg-mask-reveal[\s\S]*?clip-path:\s*inset\(100%\s+0\s+0\s+0\)/)
    expect(css).toMatch(/@keyframes\s+rg-mask-reveal-up[\s\S]*?clip-path:\s*inset\(0\)/)
  })

  it('Text Flip uses rotateX and stable-width measure', () => {
    expect(css).toMatch(/rg-text-flip-out[\s\S]*?rotateX\(-75deg\)/)
    expect(css).toMatch(/rg-text-flip-in[\s\S]*?rotateX\(75deg\)/)
    expect(css).toMatch(/\.rg-text-flip__measure/)
  })

  it('button press keeps scale(0.96) at 120ms', () => {
    expect(css).toMatch(/--dur-press:\s*120ms/)
    expect(css).toMatch(/\.ios-press:active[\s\S]*?scale\(0\.96\)/)
  })

  it('prefers-reduced-motion forces settled / unclipped styles', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rg-blur-word[\s\S]*?filter:\s*none\s*!important/,
    )
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rg-mask-reveal[\s\S]*?clip-path:\s*none\s*!important/,
    )
  })

  it('distress screens disable motion', () => {
    expect(css).toMatch(/\[data-distress-level='1'\]/)
    expect(css).toMatch(/\[data-distress-level='2'\]/)
  })

  it('PNG brand mark has no opacity/fade animation', () => {
    expect(css).toMatch(/\.brand-mark-image[\s\S]*?opacity:\s*unset\s*!important/)
    expect(css).toMatch(/jamais d’opacity\/fade sur le logo/)
  })
})
