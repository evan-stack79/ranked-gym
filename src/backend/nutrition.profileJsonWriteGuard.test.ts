/**
 * Garde structurelle B14/B16 : seul `writeNutritionProfileJson` peut écrire
 * `profileJson` via db.insert / db.patch / db.replace sous convex/.
 * clear / admin doivent appeler writeNutritionProfileJson (pas de patch direct).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  isNutritionProfileWriteAuthorized,
  writeNutritionProfileJson,
} from '../../convex/lib/nutritionProfile'

const CONVEX_ROOT = new URL('../../convex', import.meta.url).pathname
const PROFILE_FILE = 'lib/nutritionProfile.ts'

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

const INSERT_NUTRITION_STATE = /db\.insert\(\s*['"]nutrition_state['"]/
const PATCH_REPLACE_PROFILE_JSON =
  /db\.(?:patch|replace)\s*\(\s*[^,]+,\s*\{[^{}]*\bprofileJson\s*:/

function extractFunction(source: string, name: string): { body: string; startLine: number } {
  const marker = `export async function ${name}`
  const start = source.indexOf(marker)
  if (start < 0) throw new Error(`missing ${name}`)
  const startLine = source.slice(0, start).split('\n').length
  const rest = source.slice(start)
  const next = rest.search(/\nexport (?:async )?function |\nexport type |\nexport const /)
  const body = next < 0 ? rest : rest.slice(0, next)
  return { body, startLine }
}

describe('B14/B16 — garde structurelle profileJson (fichiers convex/ réels)', () => {
  it('aucun fichier hors nutritionProfile.ts n’écrit profileJson via db.*', () => {
    const offenders: string[] = []
    for (const file of listTsFiles(CONVEX_ROOT)) {
      const rel = relative(CONVEX_ROOT, file).replace(/\\/g, '/')
      if (rel === PROFILE_FILE) continue
      if (rel === 'schema.ts') continue
      const source = readFileSync(file, 'utf8')
      if (INSERT_NUTRITION_STATE.test(source) || PATCH_REPLACE_PROFILE_JSON.test(source)) {
        offenders.push(rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('writeNutritionProfileJson est le seul writer db.* profileJson dans nutritionProfile.ts', () => {
    const source = readFileSync(join(CONVEX_ROOT, PROFILE_FILE), 'utf8')
    expect(source).toContain('export async function writeNutritionProfileJson')
    expect(source).toMatch(/db\.patch\([\s\S]*profileJson/)
    expect(source).toMatch(/db\.insert\('nutrition_state'[\s\S]*profileJson/)

    // B16-04 — clear / admin ne patchent plus profileJson directement.
    for (const name of [
      'clearNutritionSafetyBoolField',
      'adminCorrectNutritionSafetyField',
    ] as const) {
      const { body, startLine } = extractFunction(source, name)
      const hits: string[] = []
      const patchHit = body.match(/db\.(?:patch|replace)\s*\([\s\S]*?\bprofileJson\s*:/)
      const insertHit = body.match(/db\.insert\(\s*['"]nutrition_state['"]/)
      if (patchHit) {
        const line = startLine + body.slice(0, patchHit.index ?? 0).split('\n').length - 1
        hits.push(`convex/lib/nutritionProfile.ts:${line}:${name}:db.patch/replace profileJson`)
      }
      if (insertHit) {
        const line = startLine + body.slice(0, insertHit.index ?? 0).split('\n').length - 1
        hits.push(`convex/lib/nutritionProfile.ts:${line}:${name}:db.insert nutrition_state`)
      }
      expect(body).toContain('writeNutritionProfileJson')
      expect(hits, hits.join('\n')).toEqual([])
    }
  })
})

describe('B15-02 — runtime write token profileJson', () => {
  it('hors writeNutritionProfileJson / clear, le token est inactif', () => {
    expect(isNutritionProfileWriteAuthorized()).toBe(false)
  })

  it('pendant writeNutritionProfileJson, le token est actif (FakeDb peut accepter)', async () => {
    let seenDuringWrite = false
    const db = {
      query: () => ({
        withIndex: () => ({
          first: async () => null,
        }),
      }),
      insert: async (_table: string, value: Record<string, unknown>) => {
        if ('profileJson' in value) {
          seenDuringWrite = isNutritionProfileWriteAuthorized()
        }
        return 'id-1'
      },
      patch: async () => undefined,
    }
    await writeNutritionProfileJson({ db } as never, {
      userId: 'u-token',
      incomingProfileJson: { age: 25 },
      updatedAt: Date.now(),
    })
    expect(seenDuringWrite).toBe(true)
    expect(isNutritionProfileWriteAuthorized()).toBe(false)
  })
})
