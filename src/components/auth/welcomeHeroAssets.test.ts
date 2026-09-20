import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const PNG_SHA =
  '1856bf7fee42246a0cb00572b2946994a77d38a4b32cb7c82cf51e4adece7ac8'
const WEBP_SHA =
  'c5715a63401c3d26c7e3a1e312f9829825a39ec32967d22375a7ec2f3226e867'

describe('welcome hero assets', () => {
  it('garde les octets exacts fournis, sans second logo ni texture générée', () => {
    const png = readFileSync('public/auth-welcome-hero.png')
    const webp = readFileSync('public/auth-welcome-hero.webp')
    expect(createHash('sha256').update(png).digest('hex')).toBe(PNG_SHA)
    expect(createHash('sha256').update(webp).digest('hex')).toBe(WEBP_SHA)
    expect(png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(
      true,
    )
    expect(webp.subarray(0, 4).toString('ascii')).toBe('RIFF')
    expect(existsSync('public/auth-welcome-logo.png')).toBe(false)
    expect(existsSync('public/auth-welcome-logo.webp')).toBe(false)
    expect(existsSync('public/auth-welcome-fabric.webp')).toBe(false)
    expect(existsSync('public/auth-welcome-fabric.avif')).toBe(false)
  })
})
