import type {
  CameraHeartRateAvailability,
  CameraHeartRatePlugin,
  CameraHeartRateProgressEvent,
  CameraHeartRateResultEvent,
} from './types'

type ProgressListener = (event: CameraHeartRateProgressEvent) => void
type ResultListener = (event: CameraHeartRateResultEvent) => void

/**
 * Stub web : pas d’analyse PPG dans le navigateur.
 * Le prototype exige le shell Capacitor (caméra + flash natifs).
 */
export class CameraHeartRateWeb implements CameraHeartRatePlugin {
  private progressListeners = new Set<ProgressListener>()
  private resultListeners = new Set<ResultListener>()

  async isAvailable(): Promise<CameraHeartRateAvailability> {
    return {
      available: false,
      platform: 'web',
      hasTorch: false,
      reason:
        'Le prototype BPM caméra est disponible uniquement dans l’app native Ranked Gym.',
    }
  }

  async startMeasurement(): Promise<void> {
    const result: CameraHeartRateResultEvent = {
      ok: false,
      reason: 'unsupported',
      message:
        'Mesure BPM indisponible sur le web. Ouvre l’app iOS ou Android avec le flag activé.',
    }
    this.resultListeners.forEach((listener) => listener(result))
  }

  async stopMeasurement(): Promise<void> {
    const result: CameraHeartRateResultEvent = {
      ok: false,
      reason: 'cancelled',
      message: 'Mesure annulée.',
    }
    this.resultListeners.forEach((listener) => listener(result))
  }

  async addListener(
    eventName: 'progress' | 'result',
    listenerFunc: ProgressListener | ResultListener,
  ): Promise<{ remove: () => Promise<void> }> {
    if (eventName === 'progress') {
      this.progressListeners.add(listenerFunc as ProgressListener)
      return {
        remove: async () => {
          this.progressListeners.delete(listenerFunc as ProgressListener)
        },
      }
    }
    this.resultListeners.add(listenerFunc as ResultListener)
    return {
      remove: async () => {
        this.resultListeners.delete(listenerFunc as ResultListener)
      },
    }
  }

  async removeAllListeners(): Promise<void> {
    this.progressListeners.clear()
    this.resultListeners.clear()
  }
}
