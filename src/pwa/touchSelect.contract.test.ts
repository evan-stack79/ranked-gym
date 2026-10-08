import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8')

/** Slice from the PWA shell lock comment so earlier #root height rules don't confuse asserts. */
function shellLockCss(): string {
  const marker = 'PWA shell: no text selection'
  const idx = css.indexOf(marker)
  expect(idx).toBeGreaterThanOrEqual(0)
  return css.slice(idx)
}

describe('PWA touch selection / scroll CSS contract', () => {
  it('disables text selection and iOS callout on the app shell UI', () => {
    const block = shellLockCss()
    expect(block).toMatch(/#root/)
    expect(block).toMatch(/\.mesh-bg/)
    expect(block).toMatch(/\[data-app-scroll-main\]/)
    expect(block).toMatch(/\.rg-tilt/)
    expect(block).toMatch(/\.accueil-gallery__hero/)
    expect(block).toMatch(/\.bottom-nav-pill/)
    expect(block).toMatch(/-webkit-user-select:\s*none/)
    expect(block).toMatch(/(?<![-\\w])user-select:\s*none/)
    expect(block).toMatch(/-webkit-touch-callout:\s*none/)
    expect(css).toMatch(/-webkit-tap-highlight-color:\s*transparent/)
  })

  it('re-enables selection on input, textarea, select, and contenteditable', () => {
    const block = shellLockCss()
    expect(block).toMatch(
      /input\s*,\s*[\s\S]*?textarea\s*,\s*[\s\S]*?select\s*,\s*[\s\S]*?\[contenteditable\][\s\S]*?-webkit-user-select:\s*text/,
    )
    expect(block).toMatch(
      /input\s*,[\s\S]*?\[contenteditable(?:='true')?\][\s\S]*?(?<![-\\w])user-select:\s*text/,
    )
    expect(block).toMatch(/-webkit-touch-callout:\s*default/)
  })

  it('TiltCard surface allows vertical (and carousel horizontal) pan', () => {
    expect(css).toMatch(/\.rg-tilt\s*\{[^}]*touch-action:\s*pan-x\s+pan-y/s)
  })

  it('card images are not webkit-draggable', () => {
    expect(css).toMatch(/img\s*\{[\s\S]*?-webkit-user-drag:\s*none/)
  })
})
