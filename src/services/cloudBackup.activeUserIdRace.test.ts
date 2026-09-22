import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Regression for circular-import TDZ:
 * nutritionStorage dynamically imports cloudBackup; cloudBackup statically imports
 * nutritionStorage. notifyLocalDataChanged used to read module-local `activeUserId`
 * (declared after imports) → ReferenceError during cycle evaluation (Vitest Unhandled
 * Rejection, especially Node 20). Fix: read via readCloudUserId() from cloudSession.
 */
describe('cloudBackup activeUserId TDZ / circular-import race', () => {
  const store = new Map<string, string>()
  let rejections: unknown[] = []

  function onUnhandled(reason: unknown) {
    rejections.push(reason)
  }

  beforeEach(() => {
    store.clear()
    rejections = []
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        store.set(k, v)
      },
      removeItem: (k: string) => {
        store.delete(k)
      },
      clear: () => store.clear(),
    })
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    process.on('unhandledRejection', onUnhandled)
    vi.resetModules()
  })

  afterEach(() => {
    process.off('unhandledRejection', onUnhandled)
    vi.unstubAllGlobals()
  })

  async function flushImportCycle() {
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }
    await new Promise<void>((r) => setTimeout(r, 0))
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }
  }

  function activeUserIdReferenceErrors(): ReferenceError[] {
    return rejections.filter(
      (r): r is ReferenceError =>
        r instanceof ReferenceError && /activeUserId/.test(String(r.message)),
    )
  }

  it('notifyLocalDataChanged body uses readCloudUserId (not TDZ-prone local activeUserId)', () => {
    const dir = dirname(fileURLToPath(import.meta.url))
    const src = readFileSync(join(dir, 'cloudBackup.ts'), 'utf8')
    const match = src.match(
      /export function notifyLocalDataChanged\(\) \{\n(?<body>[\s\S]*?)\n\}/,
    )
    expect(match?.groups?.body, 'notifyLocalDataChanged body').toBeTruthy()
    const body = match!.groups!.body
    expect(body).toContain('readCloudUserId()')
    expect(body).not.toMatch(/if\s*\(\s*!activeUserId\b/)
    expect(body).not.toMatch(/scheduleCloudPush\(\s*activeUserId\s*\)/)
  })

  it('nutrition write → dynamic cloudBackup import does not ReferenceError activeUserId', async () => {
    const nutrition = await import('./nutritionStorage')
    nutrition.saveCalorieProfile({
      weightKg: 80,
      goalWeightKg: 78,
      heightCm: 178,
      age: 25,
      sex: 'male',
      activity: 'moderate',
      morphology: 'mesomorph',
      goal: 'maintain',
      weeklyPaceKg: 0.5,
      onboardingComplete: true,
    })
    nutrition.addWaterEntry({ amountMl: 250, type: 'glass', label: 'Verre' })

    await flushImportCycle()

    expect(activeUserIdReferenceErrors()).toEqual([])

    const cloud = await import('./cloudBackup')
    expect(() => cloud.notifyLocalDataChanged()).not.toThrow()
    expect(activeUserIdReferenceErrors()).toEqual([])
  })

  it('concurrent nutrition triggers + cloudBackup import stay free of activeUserId TDZ', async () => {
    const nutrition = await import('./nutritionStorage')
    const profile = {
      weightKg: 70,
      goalWeightKg: 68,
      heightCm: 170,
      age: 30,
      sex: 'female' as const,
      activity: 'moderate' as const,
      morphology: 'mesomorph' as const,
      goal: 'cut' as const,
      weeklyPaceKg: 0.5,
      onboardingComplete: true,
    }

    await Promise.all([
      Promise.resolve().then(() => nutrition.saveCalorieProfile(profile)),
      Promise.resolve().then(() => nutrition.saveMealJournal({})),
      Promise.resolve().then(() =>
        nutrition.addWaterEntry({ amountMl: 100, type: 'glass', label: 'Verre' }),
      ),
      import('./cloudBackup'),
    ])

    await flushImportCycle()
    expect(activeUserIdReferenceErrors()).toEqual([])

    const cloud = await import('./cloudBackup')
    expect(() => cloud.notifyLocalDataChanged()).not.toThrow()
  })
})
