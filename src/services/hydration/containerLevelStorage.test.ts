import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()

describe('containerLevelStorage — mémorisation par contenant', () => {
  beforeEach(() => {
    store.clear()
    vi.resetModules()
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
  })

  it('défaut = plein ; set puis get ; clamp capacité', async () => {
    const {
      getMemorizedRemainingMl,
      setMemorizedRemainingMl,
      clearMemorizedRemainingMl,
      hasMemorizedRemainingMl,
      setContainerLevelUserId,
    } = await import('./containerLevelStorage')

    setContainerLevelUserId('u1')
    expect(hasMemorizedRemainingMl('plastic_15')).toBe(false)
    expect(getMemorizedRemainingMl('plastic_15', 1500)).toBe(1500)
    setMemorizedRemainingMl('plastic_15', 750, 1500)
    expect(hasMemorizedRemainingMl('plastic_15')).toBe(true)
    expect(getMemorizedRemainingMl('plastic_15', 1500)).toBe(750)
    setMemorizedRemainingMl('glass_25', 100, 250)
    expect(getMemorizedRemainingMl('glass_25', 250)).toBe(100)
    expect(getMemorizedRemainingMl('plastic_15', 1500)).toBe(750)
    expect(getMemorizedRemainingMl('plastic_15', 500)).toBe(500)
    clearMemorizedRemainingMl('plastic_15')
    expect(hasMemorizedRemainingMl('plastic_15')).toBe(false)
    expect(getMemorizedRemainingMl('plastic_15', 1500)).toBe(1500)
  })

  it('isole le niveau par utilisateur', async () => {
    const {
      getMemorizedRemainingMl,
      setMemorizedRemainingMl,
      setContainerLevelUserId,
    } = await import('./containerLevelStorage')

    setContainerLevelUserId('alice')
    setMemorizedRemainingMl('plastic_15', 900, 1500)
    setContainerLevelUserId('bob')
    expect(getMemorizedRemainingMl('plastic_15', 1500)).toBe(1500)
    setMemorizedRemainingMl('plastic_15', 400, 1500)
    setContainerLevelUserId('alice')
    expect(getMemorizedRemainingMl('plastic_15', 1500)).toBe(900)
  })
})
