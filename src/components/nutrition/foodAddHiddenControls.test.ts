import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Sous 18 / TCA : les boutons + / Ajouter et le scanner doivent être masqués
 * (pas seulement inertes) quand v3 est actif.
 */
describe('UI — masquage + / Ajouter / scanner pour comptes cachés', () => {
  it('NutritionDashboard conditionne QuickActions, hideAdd et BarcodeScanner', () => {
    const source = readFileSync(new URL('./NutritionDashboard.tsx', import.meta.url), 'utf8')
    expect(source).toContain('foodAddAllowed')
    expect(source).toContain('canShowMealJournal')
    expect(source).toContain('hideAdd={!foodAddAllowed}')
    expect(source).toContain('if (!foodAddAllowed) return')
    expect(source).toContain('{foodAddAllowed ? (')
  })

  it('MealJournal masque Scanner / Ajouter et le BarcodeScanner si accès refusé', () => {
    const source = readFileSync(new URL('./MealJournal.tsx', import.meta.url), 'utf8')
    expect(source).toContain('foodAddAllowed')
    expect(source).toContain('{foodAddAllowed ? (')
    expect(source).toContain('!showForm && foodAddAllowed && !foodAddV3')
    expect(source).toContain('if (!foodAddAllowed) return')
  })
})
