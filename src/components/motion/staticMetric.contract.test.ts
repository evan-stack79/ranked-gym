import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

/** Strip block/line comments so SAFETY docs mentioning CountUp don't fail import checks. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

describe('kcal / body weight never use CountUpNumber', () => {
  it('StaticKcalNumber and StaticBodyWeightNumber have no rAF / counter logic', () => {
    const src = read('src/components/motion/StaticMetricNumber.tsx')
    expect(src).toMatch(/SAFETY RULE/)
    expect(src).toMatch(/NEVER use CountUpNumber/i)
    const code = stripComments(src)
    expect(code).not.toMatch(/requestAnimationFrame/)
    expect(code).not.toMatch(/CountUpNumber/)
    expect(code).toMatch(/data-rg-metric="kcal-static"/)
    expect(code).toMatch(/data-rg-metric="body-weight-static"/)
  })

  it('NutritionCalorieRing uses StaticKcalNumber and does not import CountUpNumber', () => {
    const src = read('src/components/nutrition/NutritionCalorieRing.tsx')
    expect(src).toMatch(/StaticKcalNumber/)
    expect(src).toMatch(/never CountUpNumber/)
    const code = stripComments(src)
    expect(code).not.toMatch(/CountUpNumber/)
    expect(code).not.toMatch(/requestAnimationFrame/)
    expect(code).not.toMatch(/from ['"].*CountUp/)
  })

  it('NutritionSnapshot kcal stays on StaticKcalNumber; only water uses CountUp', () => {
    const src = read('src/components/home/NutritionSnapshot.tsx')
    expect(src).toMatch(/StaticKcalNumber/)
    expect(src).toMatch(/kcal must stay static/)
    expect(src).toMatch(/kind="water"/)
    expect(src).not.toMatch(/kind="sessions"/)
    expect(src).not.toMatch(/kind="successful_sets"/)
    expect(src).not.toMatch(/kind="kcal"/)
    expect(src).not.toMatch(/kind="body_weight"/)
  })

  it('PersonalInformationScreen weight field does not import or call CountUpNumber', () => {
    const src = read('src/components/settings/PersonalInformationScreen.tsx')
    const code = stripComments(src)
    expect(code).not.toMatch(/CountUpNumber/)
    expect(code).not.toMatch(/requestAnimationFrame/)
    expect(src).toMatch(/body weight is a form input/)
  })

  it('CountUp allowlist excludes kcal and body_weight', () => {
    const src = read('src/components/motion/CountUpNumber.tsx')
    expect(src).toMatch(/'water'/)
    expect(src).toMatch(/'sessions'/)
    expect(src).toMatch(/'successful_sets'/)
    expect(src).toMatch(/NEVER add `kcal` or `body_weight`/)
    expect(src).not.toMatch(/'kcal'/)
    expect(src).not.toMatch(/'body_weight'/)
  })
})
