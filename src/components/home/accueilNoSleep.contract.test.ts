import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Accueil sans bloc Sommeil (v11)', () => {
  it('HomeGalleryView et HomeView ne montent plus SleepSnapshot', () => {
    const gallery = readFileSync(
      resolve(__dirname, 'HomeGalleryView.tsx'),
      'utf8',
    )
    const home = readFileSync(resolve(__dirname, 'HomeView.tsx'), 'utf8')
    expect(gallery).not.toMatch(/SleepSnapshot/)
    expect(home).not.toMatch(/SleepSnapshot/)
    expect(gallery).not.toMatch(/data-sleep-home-card/)
    expect(home).not.toMatch(/data-sleep-home-card/)
  })

  it('App route sleep → SleepView', () => {
    const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8')
    expect(app).toMatch(/case 'sleep':/)
    expect(app).toMatch(/SleepView/)
  })
})
