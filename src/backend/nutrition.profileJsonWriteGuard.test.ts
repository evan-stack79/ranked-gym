/**
 * Garde structurelle B14 : seul `writeNutritionProfileJson` peut écrire
 * `profileJson` via db.insert / db.patch / db.replace sous convex/.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const CONVEX_ROOT = new URL('../../convex', import.meta.url).pathname
const ALLOWED_WRITE_FILE = 'lib/nutritionProfile.ts'

function listTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === '_generated' || name === 'node_modules') continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...listTsFiles(full))
    else if (name.endsWith('.ts')) out.push(full)
  }
  return out
}

/**
 * Écritures interdites hors lib/nutritionProfile.ts :
 * - db.insert('nutrition_state', …)
 * - db.patch/replace dont l’objet littéral contient la clé profileJson
 * (validators v.object({ profileJson }) et lectures `.profileJson` sont OK).
 */
const INSERT_NUTRITION_STATE = /db\.insert\(\s*['"]nutrition_state['"]/
const PATCH_REPLACE_PROFILE_JSON =
  /db\.(?:patch|replace)\s*\(\s*[^,]+,\s*\{[^{}]*\bprofileJson\s*:/

describe('B14 — garde structurelle profileJson', () => {
  it('aucun fichier hors writeNutritionProfileJson n’écrit profileJson via db.*', () => {
    const offenders: string[] = []
    for (const file of listTsFiles(CONVEX_ROOT)) {
      const rel = relative(CONVEX_ROOT, file).replace(/\\/g, '/')
      if (rel === ALLOWED_WRITE_FILE) continue
      if (rel === 'schema.ts') continue
      const source = readFileSync(file, 'utf8')
      if (INSERT_NUTRITION_STATE.test(source) || PATCH_REPLACE_PROFILE_JSON.test(source)) {
        offenders.push(rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('writeNutritionProfileJson est le seul writer déclaré', () => {
    const source = readFileSync(join(CONVEX_ROOT, ALLOWED_WRITE_FILE), 'utf8')
    expect(source).toContain('export async function writeNutritionProfileJson')
    expect(source).toMatch(/db\.patch\([\s\S]*profileJson/)
    expect(source).toMatch(/db\.insert\('nutrition_state'[\s\S]*profileJson/)
  })
})
