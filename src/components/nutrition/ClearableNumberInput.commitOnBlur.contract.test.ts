import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Non-regression for train kg/reps clear-while-typing.
 * Disappeared from main IPA because #118 stayed unmerged (test IPA only).
 */
describe('ClearableNumberInput commitOnBlur contract', () => {
  it('exports flushPendingClearableNumberInputs + commitOnBlur API', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/nutrition/ClearableNumberInput.tsx'),
      'utf8',
    )
    expect(src).toMatch(/export function flushPendingClearableNumberInputs/)
    expect(src).toMatch(/commitOnBlur/)
    expect(src).toMatch(/focusValueRef/)
  })

  it('ImmersiveExerciseSession uses commitOnBlur and never forces empty→0 on change', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/training/ImmersiveExerciseSession.tsx'),
      'utf8',
    )
    expect(src).toMatch(/commitOnBlur/)
    expect(src).toMatch(/flushPendingClearableNumberInputs/)
    expect(src).not.toMatch(/weightKg:\s*v\s*\?\?\s*0/)
    expect(src).not.toMatch(/reps:\s*v\s*!=\s*null\s*\?\s*Math\.round\(v\)\s*:\s*0/)
  })

  it('WorkoutNotebook uses commitOnBlur and never forces empty→0 on change', () => {
    const src = readFileSync(
      resolve(process.cwd(), 'src/components/training/WorkoutNotebook.tsx'),
      'utf8',
    )
    expect(src).toMatch(/commitOnBlur/)
    expect(src).toMatch(/flushPendingClearableNumberInputs/)
    expect(src).not.toMatch(/weightKg:\s*v\s*\?\?\s*0/)
    expect(src).not.toMatch(/reps:\s*v\s*!=\s*null\s*\?\s*Math\.round\(v\)\s*:\s*0/)
  })
})
