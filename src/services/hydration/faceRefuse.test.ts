import { describe, expect, it, vi } from 'vitest'
import { refuseIfFaceDetected } from './faceRefuse'

describe('faceRefuse (CA-HY7 / Evan visage)', () => {
  it('refuse si FaceDetector trouve un visage', async () => {
    const detect = vi.fn(async () => [{ boundingBox: {} }])
    ;(window as unknown as { FaceDetector: new () => { detect: typeof detect } }).FaceDetector =
      class {
        detect = detect
      } as never

    const canvas = document.createElement('canvas')
    canvas.width = 8
    canvas.height = 8
    const result = await refuseIfFaceDetected(canvas)
    expect(result.status).toBe('face_detected')
  })

  it('no_face si détecteur vide', async () => {
    const detect = vi.fn(async () => [])
    ;(window as unknown as { FaceDetector: new () => { detect: typeof detect } }).FaceDetector =
      class {
        detect = detect
      } as never
    const canvas = document.createElement('canvas')
    canvas.width = 4
    canvas.height = 4
    const result = await refuseIfFaceDetected(canvas)
    expect(result.status).toBe('no_face')
  })
})
