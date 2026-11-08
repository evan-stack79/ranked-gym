import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Web + Cap contracts that make Dynamic Island / home-indicator padding work
 * once ios.contentInset is `never`.
 */
describe('safe-area web contracts', () => {
  it('index.html declares viewport-fit=cover', () => {
    const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')
    expect(html).toMatch(/viewport-fit=cover/)
    expect(html).toMatch(/safe-area-inset-top/)
    expect(html).toMatch(/safe-area-inset-bottom/)
  })

  it('CSS exposes --app-safe-area-* from env(safe-area-inset-*)', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/--app-safe-area-top:\s*env\(safe-area-inset-top/)
    expect(css).toMatch(/--app-safe-area-bottom:\s*env\(safe-area-inset-bottom/)
  })

  it('AppLayout brand header pads with safe-area top (Dynamic Island)', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/layout/AppLayout.tsx'),
      'utf8',
    )
    expect(src).toMatch(/--app-safe-area-top|safe-area-inset-top/)
  })
})
