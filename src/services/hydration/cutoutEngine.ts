/**
 * Détourage Ma bouteille (HY-d) — pipeline on-device (Archi §5).
 *
 * Garde : le modèle BiRefNet-lite (~98 Mo) + Transformers.js ne sont
 * chargés qu’à la demande, depuis nos fichiers statiques.
 * Si absents / échec → le flux UI propose recadrage manuel ou mode 2 L.
 *
 * Aucune photo brute n’est uploadée.
 */

export const HYDRATION_CUTOUT_ENABLED =
  typeof import.meta !== 'undefined'
  && String((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_HYDRATION_CUTOUT ?? '')
    === '1'

export type CutoutResult =
  | { ok: true; png: Blob }
  | { ok: false; error: 'DISABLED' | 'MODEL_MISSING' | 'INFERENCE_FAILED' | 'EMPTY_MASK'; message: string }

/** Redimensionne ≤ 1024 px côté long, en mémoire. */
export async function resizeImageMaxSide(blob: Blob, maxSide = 1024): Promise<ImageBitmap> {
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale >= 1) return bitmap
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('CANVAS_2D_UNAVAILABLE')
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return createImageBitmap(canvas)
}

/** Recadrage manuel rectangle → PNG transparent simple (masque rectangulaire). */
export async function manualCropToPng(
  source: Blob,
  crop: { x: number; y: number; width: number; height: number },
): Promise<Blob> {
  const bitmap = await createImageBitmap(source)
  const canvas = document.createElement('canvas')
  const w = Math.max(1, Math.round(crop.width))
  const h = Math.max(1, Math.round(crop.height))
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    throw new Error('CANVAS_2D_UNAVAILABLE')
  }
  ctx.drawImage(
    bitmap,
    Math.round(crop.x),
    Math.round(crop.y),
    w,
    h,
    0,
    0,
    w,
    h,
  )
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('TO_BLOB_FAILED'))),
      'image/png',
    )
  })
  return blob
}

/**
 * Inférence détourage. v0 : désactivée tant que VITE_HYDRATION_CUTOUT≠1
 * et que les assets modèle ne sont pas publiés sous /models/hydration/.
 */
export async function runBottleCutout(_source: Blob): Promise<CutoutResult> {
  if (!HYDRATION_CUTOUT_ENABLED) {
    return {
      ok: false,
      error: 'DISABLED',
      message:
        'Le détourage automatique sera disponible dès que le modèle on-device est publié. Tu peux recadrer à la main ou utiliser le mode 2 L.',
    }
  }

  // Branchement prévu : worker + @huggingface/transformers + BiRefNet-lite 512
  // depuis /models/hydration/ (pas de CDN tiers au runtime).
  return {
    ok: false,
    error: 'MODEL_MISSING',
    message:
      'Modèle de détourage introuvable sur l’appareil. Recadre à la main ou passe en mode 2 L.',
  }
}

export const CUTOUT_WIFI_HINT =
  'Le modèle de détourage (~100 Mo) se télécharge une fois, de préférence en Wi-Fi. Aucune photo n’est envoyée.'
