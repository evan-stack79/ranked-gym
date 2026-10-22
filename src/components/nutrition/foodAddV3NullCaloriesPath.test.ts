/**
 * V3 app path : null kcal/macros reste null (pas || 0 / ?? 0 à l’écriture locale).
 * V3-01 : échelle via computeLocalMealNutritionFromOffHit (= serveur).
 * V3 OFF inchangé.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('V3 local journal — null calories path', () => {
  it('NutritionDashboard V3 : échelle partagée, pas de || 0 / ??= 0', () => {
    const source = readFileSync('src/components/nutrition/NutritionDashboard.tsx', 'utf8')
    expect(source).toContain('computeLocalMealNutritionFromOffHit')
    expect(source).toMatch(/calories:\s*foodAddV3\s*\?\s*v3Scaled!\.calories/)
    expect(source).not.toMatch(/calories:\s*foodAddV3\s*\?\s*\(snapshot\.calories\s*\|\|\s*0\)/)
    expect(source).not.toMatch(/v3Scaled!\.calories\s*\|\|/)
    expect(source).not.toMatch(/v3Scaled!\.calories\s*\?\?/)
    // Manuel V3 : null, pas 0
    expect(source).toMatch(/calories:\s*foodAddV3\s*\?\s*null\s*:/)
  })

  it('MealJournal V3 : échelle partagée, pas de || 0', () => {
    const source = readFileSync('src/components/nutrition/MealJournal.tsx', 'utf8')
    expect(source).toContain('computeLocalMealNutritionFromOffHit')
    expect(source).toMatch(/calories:\s*foodAddV3\s*\?\s*v3Scaled!\.calories/)
    expect(source).not.toMatch(/calories:\s*foodAddV3\s*\?\s*\(snapshot\.calories\s*\|\|\s*0\)/)
    expect(source).not.toMatch(/v3Scaled!\.calories\s*\|\|/)
    expect(source).toMatch(/calories:\s*foodAddV3\s*\?\s*null\s*:/)
  })

  it('addFoodSnapshot serveur : pas de || 0 / ??= 0 sur computed.calories', () => {
    const source = readFileSync('convex/foodAdd.ts', 'utf8')
    expect(source).toMatch(/calories:\s*computed\.calories/)
    expect(source).not.toMatch(/calories:\s*computed\.calories\s*\|\|/)
    expect(source).not.toMatch(/calories:\s*computed\.calories\s*\?\?/)
  })
})
