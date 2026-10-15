/**
 * Null kcal/macros sur nutrition_meals est additif : legacy V3-OFF (d33b724)
 * lit déjà `calories: v.optional(v.union(v.number(), v.null()))` et renvoie
 * `row.calories` tel quel — inchangé.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('legacy nutrition_meals — null kcal compatible d33b724', () => {
  it('schema nutrition_meals : calories/macros optional + null (inchangé vs d33b724)', () => {
    const schema = readFileSync(new URL('../../convex/schema.ts', import.meta.url), 'utf8')
    expect(schema).toMatch(
      /nutrition_meals:\s*defineTable\(\{[\s\S]*?calories:\s*v\.optional\(v\.union\(v\.number\(\),\s*v\.null\(\)\)\)/,
    )
    expect(schema).toMatch(/proteinG:\s*v\.optional\(v\.union\(v\.number\(\),\s*v\.null\(\)\)\)/)
    expect(schema).toContain('off_product_nutrients')
  })

  it('listJournalEntries legacy renvoie toujours row.calories (pas de strip)', () => {
    const nutrition = readFileSync(new URL('../../convex/nutrition.ts', import.meta.url), 'utf8')
    expect(nutrition).toContain('export const listJournalEntries')
    expect(nutrition).toMatch(/calories:\s*row\.calories/)
    expect(nutrition).toMatch(/proteinG:\s*row\.proteinG/)
    // Pas de listJournalEntriesV3 ici — V3 est dans foodAdd.ts
    expect(nutrition).not.toContain('listJournalEntriesV3')
  })
})
