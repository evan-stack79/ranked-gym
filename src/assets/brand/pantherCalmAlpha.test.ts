import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function pngHasAlpha(buf: Buffer): boolean {
  // IHDR color type at byte 25 (16 signature+4 len+4 IHDR+8 width/height + 1 bit depth + 1 color)
  return buf[25] === 6
}

describe('official calm panther assets', () => {
  it('master D96 détouré a un canal alpha réel', () => {
    const buf = readFileSync('src/assets/brand/panther-calm-crowned.png')
    expect(pngHasAlpha(buf)).toBe(true)
  })

  it('logo welcome overlay a un canal alpha réel', () => {
    const buf = readFileSync('public/auth-welcome-logo.png')
    expect(pngHasAlpha(buf)).toBe(true)
  })
})
