/**
 * Stockage local PNG découpé (HY-08). Jamais envoyé au serveur.
 * Natif : Capacitor Filesystem Directory.Data si dispo ; sinon IndexedDB / data URL localStorage.
 */

const IDB_NAME = 'ranked-gym-hydration'
const IDB_STORE = 'bottle-shapes'
const IDB_KEY = 'my-bottle-png'
const LS_KEY = 'ranked-gym:my-bottle-shape-dataurl'

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

export async function saveBottleShapePng(blob: Blob): Promise<void> {
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

export async function clearBottleShapeLocal(): Promise<void> {
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
