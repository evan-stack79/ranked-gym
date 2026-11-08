/**
 * Refus visage (décision Evan v0) — photo Ma bouteille.
 * On-device only. Jamais d’envoi serveur.
 *
 * Ordre :
 * 1. Shape Detection API FaceDetector si dispo
 * 2. Sinon modèle MediaPipe local (si assets présents) — optionnel
 * 3. Sinon `unavailable` → le flux UI force recadrage manuel / mode 2 L (HY-09)
 */

export type FaceRefuseResult =
  | { status: 'face_detected'; faces: number }
  | { status: 'no_face' }
  | { status: 'unavailable'; reason: string }

type FaceDetectorCtor = new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => {
  detect: (image: ImageBitmapSource) => Promise<Array<{ boundingBox: DOMRectReadOnly }>>
}

function getFaceDetectorCtor(): FaceDetectorCtor | null {
  const w = typeof window !== 'undefined' ? (window as unknown as { FaceDetector?: FaceDetectorCtor }) : null
  return w?.FaceDetector ?? null
}

/**
 * Détection visage pour refuser la photo.
 * `image` = HTMLImageElement | ImageBitmap | HTMLCanvasElement | Blob.
 */
export async function refuseIfFaceDetected(
  image: CanvasImageSource | Blob,
): Promise<FaceRefuseResult> {
  let bitmap: ImageBitmap | null = null
  let createdBitmap = false
  try {
    const Ctor = getFaceDetectorCtor()
    if (!Ctor) {
      return { status: 'unavailable', reason: 'FACE_DETECTOR_UNAVAILABLE' }
    }

    let source: ImageBitmapSource
    if (image instanceof Blob) {
      if (typeof createImageBitmap !== 'function') {
        return { status: 'unavailable', reason: 'NO_CREATE_IMAGE_BITMAP' }
      }
      bitmap = await createImageBitmap(image)
      createdBitmap = true
      source = bitmap
    } else {
      source = image as ImageBitmapSource
    }

    try {
      const detector = new Ctor({ fastMode: true, maxDetectedFaces: 3 })
      const faces = await detector.detect(source)
      if (faces.length > 0) return { status: 'face_detected', faces: faces.length }
      return { status: 'no_face' }
    } catch {
      // MediaPipe optionnel plus tard — pas de faux négatif inventé.
      return { status: 'unavailable', reason: 'FACE_DETECT_FAILED' }
    }
  } catch (error) {
    return {
      status: 'unavailable',
      reason: error instanceof Error ? error.message : 'FACE_DETECT_FAILED',
    }
  } finally {
    if (createdBitmap && bitmap) {
      try {
        bitmap.close()
      } catch {
        /* ignore */
      }
    }
  }
}

export const FACE_REFUSED_MESSAGE =
  'Un visage est visible sur la photo. Reprends la photo de ta bouteille seule, ou utilise le mode 2 L.'
