import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

describe('ios-press button feedback', () => {
  it('press scale stays on :active and reduced-motion disables transform', () => {
    expect(css).toMatch(/\.ios-press:active[\s\S]*?scale\(0\.96\)/)
    expect(css).toMatch(
      /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.ios-press:active[\s\S]*?transform:\s*none/,
    )
  })

  it('press feedback never sets pointer-events: none', () => {
    const pressBlock = css.slice(css.indexOf('.ios-press {'), css.indexOf('.ios-press:focus-visible'))
    expect(pressBlock).not.toMatch(/pointer-events:\s*none/)
  })
})
