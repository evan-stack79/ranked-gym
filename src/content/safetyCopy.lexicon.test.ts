import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as safetyCopy from './safetyCopy'
import {
  Q8_ECRAN_ORIENTATION,
  TCA_PHONE_DISPLAY,
  TCA_PHONE_TEL,
  TCA_RESOURCE_LINKS,
  TCA_RESOURCES_LAST_VERIFIED,
} from './safetyCopy'

const HERE = dirname(fileURLToPath(import.meta.url))

describe('Textes verbatim TCA / orientation', () => {
  it('Q8 égalité stricte + numéros et URLs', () => {
    expect(Q8_ECRAN_ORIENTATION).toContain('09 69 325 900')
    expect(Q8_ECRAN_ORIENTATION).toContain('0 800 235 236')
    expect(Q8_ECRAN_ORIENTATION).toContain('3114')
    expect(Q8_ECRAN_ORIENTATION).toContain('le 15')
    expect(TCA_PHONE_DISPLAY.anorexieBoulimie).toBe('09 69 325 900')
    expect(TCA_PHONE_TEL.anorexieBoulimie).toBe('tel:0969325900')
    expect(TCA_PHONE_TEL.filSanteJeunes).toBe('tel:0800235236')
    expect(TCA_PHONE_TEL.detresse).toBe('tel:3114')
    expect(TCA_PHONE_TEL.urgence).toBe('tel:15')
    expect(TCA_RESOURCE_LINKS.ffabAnnuaire).toBe(
      'https://www.ffab.fr/trouver-de-l-aide/annuaire-2021',
    )
    expect(TCA_RESOURCES_LAST_VERIFIED).toBe('2026-10-02')
  })
})

describe('Lexique SEC-TON-02 — modules de textes du lot', () => {
  it('échoue si termes interdits dans safetyCopy', () => {
    const source = readFileSync(join(HERE, 'safetyCopy.ts'), 'utf8')
    const stringLiterals = [...source.matchAll(/'([^'\\]|\\.)*'|"([^"\\]|\\.)*"/g)].map((m) =>
      m[0].slice(1, -1),
    )

    // Ancien numéro surtaxé FFAB — construit par morceaux (ne pas écrire en clair).
    const legacyPremium = ['0', '810'].join('')

    const forbidden = [
      /\brpe\b/i,
      /brûl(er|é|e|és|ées)?/i,
      /se racheter/i,
      /trich(er|e)/i,
      /mériter/i,
      /compenser/i,
      /détox/i,
      new RegExp(legacyPremium),
    ]

    for (const lit of stringLiterals) {
      for (const re of forbidden) {
        expect(lit, `interdit ${re} dans « ${lit.slice(0, 60)}… »`).not.toMatch(re)
      }
    }

    // Toutes les constantes exportées string
    for (const value of Object.values(safetyCopy)) {
      if (typeof value !== 'string') continue
      for (const re of forbidden) {
        expect(value).not.toMatch(re)
      }
    }
  })
})
