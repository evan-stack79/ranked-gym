import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const memoryStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem(k: string) {
    return memoryStore[k] ?? null
  },
  setItem(k: string, v: string) {
    memoryStore[k] = String(v)
  },
  removeItem(k: string) {
    delete memoryStore[k]
  },
  clear() {
    for (const k of Object.keys(memoryStore)) delete memoryStore[k]
  },
})

describe('clearBottleShapeLocal', () => {
  beforeEach(() => {
    localStorage.clear()
    delete (globalThis as { Capacitor?: unknown }).Capacitor
    vi.resetModules()
  })

  afterEach(() => {
    delete (globalThis as { Capacitor?: unknown }).Capacitor
  })

  it('clears localStorage even when Filesystem is absent (no throw)', async () => {
    const {
      clearBottleShapeLocal,
      BOTTLE_SHAPE_PREFS_KEY,
    } = await import('./bottleShapeStorage')
    localStorage.setItem('ranked-gym:my-bottle-shape-dataurl', 'data:image/png;base64,xxx')
    localStorage.setItem(BOTTLE_SHAPE_PREFS_KEY, 'pref')
    await expect(clearBottleShapeLocal()).resolves.toBeUndefined()
    expect(localStorage.getItem('ranked-gym:my-bottle-shape-dataurl')).toBeNull()
    expect(localStorage.getItem(BOTTLE_SHAPE_PREFS_KEY)).toBeNull()
  })

  it('deletes Capacitor Filesystem file when present; ignores missing-file errors', async () => {
    const deleteFile = vi.fn(async () => {
      throw new Error('File does not exist')
    })
    const removePref = vi.fn(async () => undefined)
    ;(globalThis as unknown as {
      Capacitor: {
        isNativePlatform: () => boolean
        Plugins: {
          Filesystem: {
            deleteFile: typeof deleteFile
            Directory: { Data: string }
          }
          Preferences: { remove: typeof removePref }
        }
      }
    }).Capacitor = {
      isNativePlatform: () => true,
      Plugins: {
        Filesystem: {
          deleteFile,
          Directory: { Data: 'DATA' },
        },
        Preferences: { remove: removePref },
      },
    }

    const {
      clearBottleShapeLocal,
      clearBottleShapeFilesystem,
      BOTTLE_SHAPE_FS_PATH,
      BOTTLE_SHAPE_PREFS_KEY,
    } = await import('./bottleShapeStorage')

    await expect(clearBottleShapeFilesystem()).resolves.toBeUndefined()
    expect(deleteFile).toHaveBeenCalledWith({
      path: BOTTLE_SHAPE_FS_PATH,
      directory: 'DATA',
    })

    await expect(clearBottleShapeLocal()).resolves.toBeUndefined()
    expect(removePref).toHaveBeenCalledWith({ key: BOTTLE_SHAPE_PREFS_KEY })
  })
})
