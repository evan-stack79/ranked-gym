import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LAUNCH_OPERATIONS } from './launchInventory'

const root = join(import.meta.dirname, '../..')

describe('launch inventory — opérations toujours présentes', () => {
  it('conserve chaque fetch / restore / sync listé au boot', () => {
    for (const op of LAUNCH_OPERATIONS) {
      for (const file of op.files) {
        const source = readFileSync(join(root, file), 'utf8')
        for (const symbol of op.symbols) {
          expect(source, `${op.id} missing ${symbol} in ${file}`).toContain(symbol)
        }
      }
    }
  })

  it('AuthContext hydrate toujours session + profil + backup + streak', () => {
    const source = readFileSync(join(root, 'src/context/AuthContext.tsx'), 'utf8')
    expect(source).toContain('hydrateCloudBackupForUser')
    expect(source).toContain('ensureProfile')
    expect(source).toContain('fetchProfile')
    expect(source).toContain('applyDailyLoginStreak')
    expect(source).toContain('getSession')
    expect(source).toContain('getConvexSessionUser')
  })

  it('main.tsx initialise toujours les stores locaux avant render', () => {
    const source = readFileSync(join(root, 'src/main.tsx'), 'utf8')
    expect(source).toContain('initSecureAuthStorage')
    expect(source).toContain('initSecureLocalStore')
  })
})
