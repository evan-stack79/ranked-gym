import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  GOAL_DEFAULT_ML,
  GOAL_MAX_ML,
  GOAL_MIN_ML,
  HIGH_INFO_THRESHOLD_ML,
  GLASS_ML,
  CLASSIC_BOTTLE_ML,
  LABEL_EAU_BUE_SEULE,
  MSG_HIGH_INFO,
  MSG_PERMANENT,
  MSG_SPORT_HEAT,
} from '../../shared/hydration/constants'
import { fillRatio, remainingMl, showHighInfo } from '../../shared/hydration/math'

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walkTsFiles(full))
    else if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(full)
  }
  return out
}

describe('HY isolation §8 / RK-03', () => {
  it('convex/hydration* n’importe pas ranked* ni rewards*', () => {
    const files = [
      resolve('convex/hydration.ts'),
      resolve('convex/lib/hydrationConstants.ts'),
      resolve('convex/lib/proEntitlement.ts'),
    ]
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      expect(src).not.toMatch(/from ['"].*ranked/)
      expect(src).not.toMatch(/from ['"].*rewards/)
      expect(src).not.toMatch(/api\.ranked/)
      expect(src).not.toMatch(/api\.rewards/)
    }
  })

  it('ranked.ts / rewards.ts n’importent pas hydration', () => {
    for (const file of ['convex/ranked.ts', 'convex/rewards.ts']) {
      const src = readFileSync(resolve(file), 'utf8')
      expect(src).not.toMatch(/hydration/)
    }
  })

  it('aucune écriture XP / Discipline / ledger depuis modules hydration client', () => {
    const root = resolve('src/services/hydration')
    const files = walkTsFiles(root)
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
      expect(src).not.toMatch(/creditFromDiscipline|rewardsLedger|rankedForce|disciplineScore/)
    }
  })
})

describe('CA-HY constantes & messages (HY-e)', () => {
  it('CA-HY4 bornes curseur 1–3 L', () => {
    expect(GOAL_MIN_ML).toBe(1000)
    expect(GOAL_MAX_ML).toBe(3000)
    expect(GOAL_DEFAULT_ML).toBe(1500)
  })

  it('CA-HY3 / CA-HY5 / C-HY4 messages §9', () => {
    expect(HIGH_INFO_THRESHOLD_ML).toBe(3000)
    expect(showHighInfo(3000)).toBe(true)
    expect(MSG_HIGH_INFO).toContain('repère')
    expect(MSG_PERMANENT).toContain('ne sont pas comptés')
    expect(MSG_SPORT_HEAT).toContain('soif')
    expect(LABEL_EAU_BUE_SEULE).toBe('Eau bue seule')
  })

  it('CA-HY2 / CA-HY10 modes gratuits 2L + verres', () => {
    expect(CLASSIC_BOTTLE_ML).toBe(2000)
    expect(GLASS_ML).toBe(250)
  })

  it('CA-HY6 maths affichage sans rang', () => {
    expect(remainingMl(1500, 500)).toBe(1000)
    expect(fillRatio(1500, 500)).toBeCloseTo(2 / 3)
  })
})
