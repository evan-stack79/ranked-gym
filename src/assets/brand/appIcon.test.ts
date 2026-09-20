import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'

const root = process.cwd()

function pngSize(file: string) {
  const buf = readFileSync(file)
  if (buf.subarray(0, 8).toString('binary') !== '\x89PNG\r\n\x1a\n') {
    throw new Error(`not a PNG: ${file}`)
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

async function countVisibleGreen(file: string) {
  const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 12) continue
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    if (g > r + 35 && g > b + 35 && g > 90) n++
  }
  return n
}

async function cornerRgb(file: string) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const i = 0
  return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3], width: info.width }
}

describe('home-screen / PWA / native app icons', () => {
  const master = resolve(root, 'public/brand/app-icon-master.png')
  const opaque = resolve(root, 'src/assets/brand/panther-icon-opaque.png')

  it('keeps an exact master copy of the closed-mouth panther plate', () => {
    const masterBuf = readFileSync(master)
    const opaqueBuf = readFileSync(opaque)
    expect(createHash('sha256').update(masterBuf).digest('hex')).toBe(
      createHash('sha256').update(opaqueBuf).digest('hex'),
    )
    const size = pngSize(master)
    expect(size.width).toBe(size.height)
    expect(size.width).toBeGreaterThanOrEqual(1024)
  })

  it('emits the required web / PWA / apple-touch sizes', () => {
    expect(pngSize(resolve(root, 'public/apple-touch-icon.png'))).toEqual({ width: 180, height: 180 })
    expect(pngSize(resolve(root, 'public/icon.png'))).toEqual({ width: 180, height: 180 })
    expect(pngSize(resolve(root, 'public/pwa-192x192.png'))).toEqual({ width: 192, height: 192 })
    expect(pngSize(resolve(root, 'public/pwa-512x512.png'))).toEqual({ width: 512, height: 512 })
    expect(pngSize(resolve(root, 'public/pwa-maskable-512x512.png'))).toEqual({
      width: 512,
      height: 512,
    })
    expect(pngSize(resolve(root, 'public/favicon.png'))).toEqual({ width: 64, height: 64 })
  })

  it('points index.html and the PWA manifest source at the new icon files', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8')
    expect(html).toMatch(/rel="icon" type="image\/png" href="\/favicon\.png"/)
    expect(html).toMatch(/rel="apple-touch-icon" href="\/apple-touch-icon\.png"/)
    expect(html).toMatch(/rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon\.png"/)

    const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
    expect(vite).toMatch(/src: 'pwa-192x192\.png'/)
    expect(vite).toMatch(/src: 'pwa-512x512\.png'/)
    expect(vite).toMatch(/src: 'pwa-maskable-512x512\.png'/)
    expect(vite).toMatch(/purpose: 'maskable'/)
    expect(vite).toMatch(/'apple-touch-icon\.png'/)
  })

  it('keeps native Capacitor sources and generated launcher plates', () => {
    expect(pngSize(resolve(root, 'assets/icon-only.png'))).toEqual({ width: 1024, height: 1024 })
    expect(pngSize(resolve(root, 'assets/icon-foreground.png'))).toEqual({
      width: 1024,
      height: 1024,
    })
    expect(pngSize(resolve(root, 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'))).toEqual(
      { width: 192, height: 192 },
    )
    expect(
      pngSize(resolve(root, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')),
    ).toEqual({ width: 1024, height: 1024 })
    expect(pngSize(resolve(root, 'resources/icon.png')).width).toBeGreaterThanOrEqual(1024)
  })

  it('uses a padded maskable plate so adaptive crop does not clip the crown', async () => {
    const anyCorner = await cornerRgb(resolve(root, 'public/pwa-512x512.png'))
    const maskableCorner = await cornerRgb(resolve(root, 'public/pwa-maskable-512x512.png'))
    // Maskable outer margin is the product background, not the glow plate edge.
    expect(maskableCorner.r).toBe(0x0c)
    expect(maskableCorner.g).toBe(0x0c)
    expect(maskableCorner.b).toBe(0x0e)
    expect(anyCorner.r + anyCorner.g + anyCorner.b).toBeLessThan(40)
  })

  it('has no chroma-key green left in the generated icon plates', async () => {
    const files = [
      'public/brand/app-icon-master.png',
      'public/apple-touch-icon.png',
      'public/icon.png',
      'public/pwa-192x192.png',
      'public/pwa-512x512.png',
      'public/pwa-maskable-512x512.png',
      'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png',
    ]
    for (const rel of files) {
      expect(await countVisibleGreen(resolve(root, rel)), rel).toBe(0)
    }
  })
})
