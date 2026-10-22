import { describe, expect, it } from 'vitest'
import { parseCiqualKcalTeneur } from './ciqualParse'

describe('parseCiqualKcalTeneur', () => {
  it('virgule française → nombre', () => {
    expect(parseCiqualKcalTeneur('90,5')).toBe(90.5)
    expect(parseCiqualKcalTeneur(' 375 ')).toBe(375)
  })

  it('« - », traces, < x → null (jamais 0)', () => {
    expect(parseCiqualKcalTeneur('-')).toBeNull()
    expect(parseCiqualKcalTeneur('–')).toBeNull()
    expect(parseCiqualKcalTeneur('traces')).toBeNull()
    expect(parseCiqualKcalTeneur('< 0,5')).toBeNull()
    expect(parseCiqualKcalTeneur('<1')).toBeNull()
    expect(parseCiqualKcalTeneur('')).toBeNull()
    expect(parseCiqualKcalTeneur(null)).toBeNull()
  })

  it('0 brut → null (ne pas exposer 0 inventé)', () => {
    expect(parseCiqualKcalTeneur('0')).toBeNull()
    expect(parseCiqualKcalTeneur('0,0')).toBeNull()
  })
})
