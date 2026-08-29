/** Contrat JS ↔ natif pour le prototype BPM caméra (aucune persistance). */

export type CameraHeartRatePhase =
  | 'idle'
  | 'waiting_finger'
  | 'measuring'
  | 'complete'
  | 'insufficient_signal'
  | 'cancelled'
  | 'error'

export interface CameraHeartRateProgressEvent {
  phase: string
  signalQuality: number
  fingerDetected: boolean
  bpmPreview?: number | null
  elapsedMs: number
  message?: string
}

export interface CameraHeartRateResultEvent {
  ok: boolean
  bpm?: number
  confidence?: number
  reason?: string
  message?: string
}

export interface CameraHeartRateAvailability {
  available: boolean
  platform: 'ios' | 'android' | 'web'
  hasTorch: boolean
  reason?: string
}

export interface CameraHeartRatePlugin {
  isAvailable(): Promise<CameraHeartRateAvailability>
  startMeasurement(): Promise<void>
  stopMeasurement(): Promise<void>
  addListener(
    eventName: 'progress',
    listenerFunc: (event: CameraHeartRateProgressEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'result',
    listenerFunc: (event: CameraHeartRateResultEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>
  removeAllListeners(): Promise<void>
}

/** @deprecated alias — Capacitor expose aussi removeAllListeners via le proxy. */
export type CameraHeartRateRemoveAll = CameraHeartRatePlugin['removeAllListeners']
