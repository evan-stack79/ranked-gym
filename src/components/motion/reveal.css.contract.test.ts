import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

describe('reveal / blur-in CSS contract', () => {
  it('settled blur-in clears filter, opacity, and transform', () => {
    expect(css).toMatch(/\.rg-blur-in--settled[\s\S]*?filter:\s*none/)
    expect(css).toMatch(/\.rg-blur-in--settled[\s\S]*?opacity:\s*1/)
    expect(css).toMatch(/\.rg-blur-in--settled[\s\S]*?transform:\s*none/)
  })

  it('prefers-reduced-motion forces visible settled styles', () => {
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rg-blur-in[\s\S]*?filter:\s*none\s*!important/,
    )
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.rg-reveal[\s\S]*?opacity:\s*1\s*!important/,
    )
  })

  it('uses short reveal duration and ease-out token', () => {
    expect(css).toMatch(/--dur-reveal:\s*400ms/)
    expect(css).toMatch(/rg-reveal-in\s+var\(--dur-reveal\)\s+var\(--ease-out\)/)
    expect(css).toMatch(/rg-blur-in\s+var\(--dur-reveal\)\s+var\(--ease-out\)/)
  })
})
