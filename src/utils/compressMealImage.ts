/**
 * Compression photo repas côté client (équivalent Expo ImageManipulator).
 * Web PWA : canvas → JPEG redimensionné avant envoi à l’Edge Function Gemini.
 */

const MAX_EDGE_PX = 1024
const JPEG_QUALITY = 0.72
const MAX_INPUT_BYTES = 15 * 1024 * 1024

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Impossible de lire cette image.'))
    }
    img.src = url
  })
}

export type CompressedMealImage = {
  blob: Blob
  mimeType: 'image/jpeg'
  width: number
  height: number
  /** Base64 sans préfixe data: */
  base64: string
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(new Error('Lecture base64 impossible.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Redimensionne (max 1024px) + JPEG ~0.72 pour accélérer Gemini.
 */
export async function compressMealImage(file: File | Blob): Promise<CompressedMealImage> {
  if (file instanceof File && file.type && !file.type.startsWith('image/')) {
    throw new Error('Choisis une photo (JPG, PNG, WEBP…).')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('Image trop lourde (max 15 Mo).')
  }

  const img = await loadImage(file)
  const scale = Math.min(1, MAX_EDGE_PX / Math.max(img.width, img.height))
  const width = Math.max(1, Math.round(img.width * scale))
  const height = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas indisponible sur cet appareil.')

  ctx.fillStyle = '#0C0C0E'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(img, 0, 0, width, height)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob) throw new Error('Échec de la compression.')

  const base64 = await blobToBase64(blob)
  return { blob, mimeType: 'image/jpeg', width, height, base64 }
}
