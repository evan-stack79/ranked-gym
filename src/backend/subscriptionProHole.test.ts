import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../..')

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === 'dist' || ent.name === '_generated') continue
    const p = resolve(dir, ent.name)
    if (ent.isDirectory()) walkTsFiles(p, out)
    else if (/\.(ts|tsx)$/.test(ent.name)) out.push(p)
  }
  return out
}

describe('CA-PRO4 — aucun chemin client n’active Pro', () => {
  it('ne publie pas setPro / setProForTests en mutation publique', () => {
    const src = readFileSync(resolve(root, 'convex/subscriptions.ts'), 'utf8')
    expect(src).not.toMatch(/export const setPro\s*=\s*mutation/)
    expect(src).not.toMatch(/export const setProForTests\s*=\s*mutation/)
    // Alignement #142 : grant test uniquement internal
    expect(src).toMatch(/export const grantLocalTestPro = internalMutation/)
    expect(src).toMatch(/LOCAL_TEST_GRANT_FORBIDDEN_IN_PRODUCTION/)
  })

  it('aucun module src (hors tests) n’appelle setProForTests / grantLocalTestPro', () => {
    const files = walkTsFiles(resolve(root, 'src')).filter(
      (f) => !f.includes('.test.') && !f.includes('.spec.'),
    )
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      expect(text).not.toMatch(/setProForTests/)
      expect(text).not.toMatch(/grantLocalTestPro/)
      expect(text).not.toMatch(/api\.subscriptions\.grantLocalTestPro/)
    }
  })

  it('l’adaptateur d’achat force grantsPro: false', () => {
    const fake = readFileSync(resolve(root, 'src/native/purchases/fakeStore.ts'), 'utf8')
    const capgo = readFileSync(resolve(root, 'src/native/purchases/capgoAdapter.ts'), 'utf8')
    expect(fake).toMatch(/grantsPro:\s*false/)
    expect(capgo).toMatch(/grantsPro:\s*false/)
    expect(capgo).toMatch(/autoFinishTransactions:\s*false/)
  })
})
