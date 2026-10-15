import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')

describe('viewport meta (pinch / page-scale)', () => {
  it('keeps production Accueil free of pinch-zoom (maximum-scale + user-scalable)', () => {
    const match = html.match(/<meta\s+name=["']viewport["']\s+content=["']([^"']+)["']/i)
    expect(match).not.toBeNull()
    const content = match![1]!
    expect(content).toMatch(/width=device-width/)
    expect(content).toMatch(/initial-scale=1(\.0)?/)
    // Already the app policy — tilt interactions must not open a pinch path.
    expect(content).toMatch(/maximum-scale=1(\.0)?/)
    expect(content).toMatch(/user-scalable=0/)
  })
})
