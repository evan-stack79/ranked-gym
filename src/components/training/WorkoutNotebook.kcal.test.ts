import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('QA BUG-09 — veto Q15 : aucune kcal dépensée dans WorkoutNotebook', () => {
  it('ne contient plus l’affichage ~N kcal sous Terminer la séance', () => {
    const src = readFileSync(
      resolve(__dirname, './WorkoutNotebook.tsx'),
      'utf8',
    )
    expect(src).not.toMatch(/~\s*\{?\s*stats\.kcal/)
    expect(src).not.toMatch(/~\{stats\.kcal\} kcal/)
    // Garde : le libellé Terminer la séance reste
    expect(src).toContain('Terminer la séance')
  })
})
