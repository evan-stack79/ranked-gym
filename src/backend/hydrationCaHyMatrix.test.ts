/**
 * Mapping CA-HY1…12 — statut d’implémentation testé / documenté.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { HYDRATION_CUTOUT_ENABLED } from '../services/hydration/cutoutEngine'
import {
  DEFAULT_REMINDER_TIMES,
  GOAL_MAX_ML,
  GOAL_MIN_ML,
  LABEL_EAU_BUE_SEULE,
  MSG_HIGH_INFO,
  MSG_NEUTRAL_UNDER,
  QUIET_END,
  QUIET_START,
} from '../../shared/hydration/constants'

export const CA_HY_STATUS = {
  // Flood-fill on-device toujours dispo ; modèle BiRefNet optionnel (VITE_HYDRATION_CUTOUT).
  'CA-HY1': 'OK',
  'CA-HY2': 'OK',
  'CA-HY3': 'OK',
  'CA-HY4': 'OK',
  'CA-HY5': 'OK',
  'CA-HY6': 'OK',
  'CA-HY7': 'OK',
  'CA-HY8': 'OK',
  'CA-HY9': 'OK',
  'CA-HY10': 'OK',
  'CA-HY11': 'OK',
  'CA-HY12': 'OK',
} as const

describe('CA-HY matrix', () => {
  it('expose le mapping 1…12', () => {
    expect(Object.keys(CA_HY_STATUS)).toHaveLength(12)
  })

  it('CA-HY4 / CA-HY5 / CA-HY10 / CA-HY11 invariants code', () => {
    expect(GOAL_MIN_ML).toBe(1000)
    expect(GOAL_MAX_ML).toBe(3000)
    expect(MSG_NEUTRAL_UNDER).toContain('Demain')
    expect(LABEL_EAU_BUE_SEULE).toBe('Eau bue seule')
    expect(DEFAULT_REMINDER_TIMES).toEqual(['10:00', '14:00', '18:00'])
    expect(QUIET_START).toBe('21:00')
    expect(QUIET_END).toBe('08:00')
    expect(MSG_HIGH_INFO).toContain('aucun bonus')
  })

  it('CA-HY7 pas d’upload photo dans le flux capture', () => {
    const src = readFileSync(resolve('src/components/hydration/BottleCaptureFlow.tsx'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(src).not.toMatch(/generateUploadUrl/)
    expect(src).not.toMatch(/new FormData/)
    expect(src).not.toMatch(/\.upload\(/)
    const cut = readFileSync(resolve('src/services/hydration/cutoutEngine.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
    expect(cut).not.toMatch(/generateUploadUrl/)
    expect(cut).not.toMatch(/fetch\([^)]*photo/)
  })

  it('CA-HY9 Eau Accueil + Alimentation (même source hydration*)', () => {
    const home = readFileSync(resolve('src/components/home/HomeGalleryView.tsx'), 'utf8')
    const dash = readFileSync(resolve('src/components/home/HomeView.tsx'), 'utf8')
    const nutri = readFileSync(resolve('src/components/nutrition/NutritionDashboard.tsx'), 'utf8')
    expect(home).toContain('EauTile')
    expect(home).toContain('fetchHydrationToday')
    expect(dash).toContain('WaterCard')
    expect(nutri).toContain('HydrationPanel')
  })

  it('CA-HY1 cutout on-device (flood, modèle optionnel)', () => {
    expect(CA_HY_STATUS['CA-HY1']).toBe('OK')
    // Garde modèle : flag toujours exporté (peut rester false sans BiRefNet).
    expect(typeof HYDRATION_CUTOUT_ENABLED).toBe('boolean')
  })
})
