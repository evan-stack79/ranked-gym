import { registerPlugin } from '@capacitor/core'
import { CameraHeartRateWeb } from './web'
import type { CameraHeartRatePlugin } from './types'

export type {
  CameraHeartRateAvailability,
  CameraHeartRatePhase,
  CameraHeartRatePlugin,
  CameraHeartRateProgressEvent,
  CameraHeartRateResultEvent,
} from './types'
export {
  CAMERA_HEART_RATE_DISCLAIMER,
  isCameraHeartRateEnabled,
} from './featureFlag'

/**
 * Bridge Capacitor. Sur le web → stub.
 * Sur iOS/Android → implémentation native (AVFoundation / CameraX),
 * sans transfert d’images vers JavaScript.
 */
const CameraHeartRate = registerPlugin<CameraHeartRatePlugin>('CameraHeartRate', {
  web: () => new CameraHeartRateWeb(),
})

export { CameraHeartRate }
