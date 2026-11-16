/**
 * Stockage local PNG découpé (HY-08). Jamais envoyé au serveur.
 * Natif : Capacitor Filesystem Directory.Data si dispo ; sinon IndexedDB / data URL localStorage.
 * Preferences / localStorage / IDB / FS sont tous vidés à la suppression de compte.
 */

const IDB_NAME = 'ranked-gym-hydration'
const IDB_STORE = 'bottle-shapes'
const IDB_KEY = 'my-bottle-png'
const LS_KEY = 'ranked-gym:my-bottle-shape-dataurl'
/** Path under Directory.Data when Filesystem plugin is present. */
export const BOTTLE_SHAPE_FS_PATH = 'ranked-gym/my-bottle-shape.png'
export const BOTTLE_SHAPE_PREFS_KEY = 'ranked-gym:my-bottle-shape'

type CapFilesystem = {
  writeFile: (opts: {
    path: string
    data: string
    directory: string
    recursive?: boolean
  }) => Promise<{ uri: string }>
  deleteFile: (opts: { path: string; directory: string }) => Promise<void>
  Directory?: { Data?: string; CACHE?: string; Cache?: string }
}

type CapPreferences = {
  remove: (opts: { key: string }) => Promise<void>
  set?: (opts: { key: string; value: string }) => Promise<void>
}

function getCapacitorPlugins(): {
  Filesystem?: CapFilesystem
  Preferences?: CapPreferences
  isNative?: boolean
} {
  try {
    const cap = (
      globalThis as unknown as {
        Capacitor?: {
          isNativePlatform?: () => boolean
          Plugins?: {
            Filesystem?: CapFilesystem
            Preferences?: CapPreferences
          }
        }
      }
    ).Capacitor
    return {
      Filesystem: cap?.Plugins?.Filesystem,
      Preferences: cap?.Plugins?.Preferences,
      isNative: Boolean(cap?.isNativePlatform?.()),
    }
  } catch {
    return {}
  }
}

function fsDirectory(fs: CapFilesystem): string {
  return fs.Directory?.Data ?? 'DATA'
}

async function blobToBase64(blob: Blob): Promise<string> {
  const dataUrl = await blobToDataUrl(blob)
  const i = dataUrl.indexOf(',')
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('NO_IDB'))
      return
    }
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IDB_OPEN_FAILED'))
  })
}

async function idbPut(blob: Blob): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(blob, IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IDB_PUT_FAILED'))
  })
  db.close()
}

async function idbGet(): Promise<Blob | null> {
  const db = await openDb()
  const blob = await new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(IDB_KEY)
    req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('IDB_GET_FAILED'))
  })
  db.close()
  return blob
}

async function idbDelete(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(IDB_KEY)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IDB_DEL_FAILED'))
  })
  db.close()
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('READ_FAILED'))
    reader.readAsDataURL(blob)
  })
}

async function writeFilesystem(blob: Blob): Promise<boolean> {
  const { Filesystem, isNative } = getCapacitorPlugins()
  if (!isNative || !Filesystem?.writeFile) return false
  try {
    const data = await blobToBase64(blob)
    await Filesystem.writeFile({
      path: BOTTLE_SHAPE_FS_PATH,
      data,
      directory: fsDirectory(Filesystem),
      recursive: true,
    })
    return true
  } catch {
    return false
  }
}

/** Efface le fichier natif s'il existe — jamais d'erreur si absent. */
export async function clearBottleShapeFilesystem(): Promise<void> {
  const { Filesystem, isNative } = getCapacitorPlugins()
  if (!isNative || !Filesystem?.deleteFile) return
  try {
    await Filesystem.deleteFile({
      path: BOTTLE_SHAPE_FS_PATH,
      directory: fsDirectory(Filesystem),
    })
  } catch {
    /* missing file / plugin — ok */
  }
}

async function clearBottleShapePreferences(): Promise<void> {
  const { Preferences } = getCapacitorPlugins()
  if (Preferences?.remove) {
    try {
      await Preferences.remove({ key: BOTTLE_SHAPE_PREFS_KEY })
    } catch {
      /* ignore */
    }
  }
  try {
    localStorage.removeItem(BOTTLE_SHAPE_PREFS_KEY)
  } catch {
    /* ignore */
  }
}

export async function saveBottleShapePng(blob: Blob): Promise<void> {
  await writeFilesystem(blob)
  try {
    await idbPut(blob)
    try {
      localStorage.removeItem(LS_KEY)
    } catch {
      /* ignore */
    }
    return
  } catch {
    const dataUrl = await blobToDataUrl(blob)
    localStorage.setItem(LS_KEY, dataUrl)
  }
}

export async function loadBottleShapeUrl(): Promise<string | null> {
  try {
    const blob = await idbGet()
    if (blob) return URL.createObjectURL(blob)
  } catch {
    /* fall through */
  }
  try {
    return localStorage.getItem(LS_KEY)
  } catch {
    return null
  }
}

/**
 * Wipe complet Ma bouteille : Filesystem + Preferences + IDB + localStorage.
 * Ne throw jamais (fichier absent = succès).
 */
export async function clearBottleShapeLocal(): Promise<void> {
  await clearBottleShapeFilesystem()
  await clearBottleShapePreferences()
  try {
    await idbDelete()
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(LS_KEY)
  } catch {
    /* ignore */
  }
}
