/**
 * Détourage Ma bouteille (HY-d) — pipeline on-device (Archi §5).
 *
 * 1) Si `VITE_HYDRATION_CUTOUT=1` + modèle BiRefNet publiés → inférence (prévu).
 * 2) Sinon : détourage simple sur l’appareil (flood-fill coins → alpha).
 *    Aucune clé / service payant. Si le résultat est trop vide → erreur
 *    pour basculer sur recadrage manuel.
 *
 * Aucune photo brute n’est uploadée.
 */

export const HYDRATION_CUTOUT_ENABLED =
  typeof import.meta !== 'undefined'
  && String((import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_HYDRATION_CUTOUT ?? '')
    === '1'

export type CutoutResult =
  | { ok: true; png: Blob; method: 'model' | 'flood' }
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

function colorDistSq(
  data: Uint8ClampedArray,
  i: number,
  r0: number,
  g0: number,
  b0: number,
): number {
  const dr = data[i]! - r0
  const dg = data[i + 1]! - g0
  const db = data[i + 2]! - b0
  return dr * dr + dg * dg + db * db
}

/**
 * Détourage raisonnable sans modèle : flood-fill depuis les 4 coins
 * sur fond uni / proche, puis alpha = 0 sur le fond.
 */
export async function runFloodCutout(source: Blob): Promise<CutoutResult> {
  try {
    const bitmap = await resizeImageMaxSide(source, 768)
    const w = bitmap.width
    const h = bitmap.height
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      bitmap.close()
      return {
        ok: false,
        error: 'INFERENCE_FAILED',
        message: 'Détourage impossible sur cet appareil. Recadre à la main.',
      }
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const image = ctx.getImageData(0, 0, w, h)
    const { data } = image
    const visited = new Uint8Array(w * h)
    const threshold = 48 * 48 // ~48 RGB
    const seeds = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
      [Math.floor(w / 2), 0],
      [Math.floor(w / 2), h - 1],
    ] as const

    const queue: number[] = []
    for (const [sx, sy] of seeds) {
      const si = (sy * w + sx) * 4
      const r0 = data[si]!
      const g0 = data[si + 1]!
      const b0 = data[si + 2]!
      queue.length = 0
      queue.push(sy * w + sx)
      while (queue.length > 0) {
        const idx = queue.pop()!
        if (visited[idx]) continue
        const x = idx % w
        const y = (idx - x) / w
        const pi = idx * 4
        if (colorDistSq(data, pi, r0, g0, b0) > threshold) continue
        visited[idx] = 1
        data[pi + 3] = 0
        if (x > 0) queue.push(idx - 1)
        if (x + 1 < w) queue.push(idx + 1)
        if (y > 0) queue.push(idx - w)
        if (y + 1 < h) queue.push(idx + w)
      }
    }

    let opaque = 0
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! > 16) opaque += 1
    }
    const ratio = opaque / (w * h)
    if (ratio < 0.04 || ratio > 0.92) {
      return {
        ok: false,
        error: 'EMPTY_MASK',
        message:
          'Détourage auto peu fiable sur cette photo. Recadre à la main ou passe en mode 2 L.',
      }
    }

    ctx.putImageData(image, 0, 0)
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('TO_BLOB_FAILED'))),
        'image/png',
      )
    })
    return { ok: true, png, method: 'flood' }
  } catch {
    return {
      ok: false,
      error: 'INFERENCE_FAILED',
      message: 'Détourage impossible. Recadre à la main ou passe en mode 2 L.',
    }
  }
}

/**
 * Inférence détourage. Préfère le modèle si activé, sinon flood-fill local.
 */
export async function runBottleCutout(source: Blob): Promise<CutoutResult> {
  if (HYDRATION_CUTOUT_ENABLED) {
    // Branchement prévu : worker + @huggingface/transformers + BiRefNet-lite 512
    // depuis /models/hydration/ (pas de CDN tiers au runtime).
    // Tant que le modèle n’est pas publié, bascule flood-fill.
    const flood = await runFloodCutout(source)
    if (flood.ok) return flood
    return {
      ok: false,
      error: 'MODEL_MISSING',
      message:
        'Modèle de détourage introuvable sur l’appareil. Recadre à la main ou passe en mode 2 L.',
    }
  }

  return runFloodCutout(source)
}

export const CUTOUT_WIFI_HINT =
  'Le détourage se fait sur l’appareil. Aucune photo n’est envoyée. Sur fond uni, le résultat est meilleur.'
