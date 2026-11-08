import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

async function countReds(file: string) {
  const { data } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let exact = 0
  let oldBrand = 0
  let near = 0
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 200) continue
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    if (r === 255 && g === 7 && b === 2) exact += 1
    if (r > 240 && g >= 30 && b >= 30) oldBrand += 1
    if (r > 240 && g < 20 && b < 20) near += 1
  }
  return { exact, oldBrand, near }
}

describe('marque header et splash IPA — palette Radix #FF0702', () => {
  it('la panthère du header n’est plus l’ancien #FF2B2B', async () => {
    const { oldBrand, near } = await countReds('public/brand-header-mark.png')
    expect(oldBrand).toBe(0)
    expect(near).toBeGreaterThan(100)
  })

  it('le splash embarqué dans l’IPA contient le rouge Radix #FF0702', async () => {
    const { exact, oldBrand, near } = await countReds(
      'ios/App/App/Assets.xcassets/Splash.imageset/Default@2x~universal~anyany-dark.png',
    )
    expect(exact).toBeGreaterThan(0)
    expect(oldBrand).toBe(0)
    expect(near).toBeGreaterThan(1000)
  })
})
