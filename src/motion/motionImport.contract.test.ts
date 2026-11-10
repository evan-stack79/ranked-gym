import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(process.cwd(), 'src')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !name.includes('.test.')) out.push(p)
  }
  return out
}

describe('motion library imports', () => {
  it('only allows motion/mini — never motion/react or framer-motion', () => {
    const files = walk(root)
    const offenders: string[] = []
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      if (/from\s+['"]framer-motion['"]/.test(src)) offenders.push(`${file}: framer-motion`)
      if (/from\s+['"]motion\/react['"]/.test(src)) offenders.push(`${file}: motion/react`)
      if (/from\s+['"]motion['"]/.test(src)) offenders.push(`${file}: motion (bare)`)
    }
    expect(offenders).toEqual([])
  })

  it('does not introduce VITE_ENABLE_CALORIE_GOAL in animation files', () => {
    const checked = [
      'src/components/training/BravoShine.tsx',
      'src/components/training/VictoryCamera.tsx',
      'src/components/ranked/RankUpCelebrationOverlay.tsx',
      'src/motion/rankUpConfetti.ts',
      'src/motion/brandPress.ts',
    ]
    for (const rel of checked) {
      const src = readFileSync(join(process.cwd(), rel), 'utf8')
      expect(src).not.toMatch(/VITE_ENABLE_CALORIE_GOAL/)
    }
  })
})
