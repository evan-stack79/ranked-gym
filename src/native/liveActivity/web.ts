import type {
  LiveActivityAvailability,
  LiveActivityNativeAction,
  LiveActivityPlugin,
  LiveActivitySessionPayload,
} from './types'

/**
 * Stub web / Android — no-op propre, aucune erreur, aucune UI Island simulée.
 */
export class LiveActivityWeb implements LiveActivityPlugin {
  async isAvailable(): Promise<LiveActivityAvailability> {
    return {
      available: false,
      authorized: false,
      platform: 'web',
      reason: 'Live Activities sont disponibles uniquement sur iOS 16.2+ (shell natif).',
    }
  }

  async start(
    _options: LiveActivitySessionPayload,
  ): Promise<{ started: boolean; reason: string }> {
    return { started: false, reason: 'unsupported' }
  }

  async update(_options: LiveActivitySessionPayload): Promise<void> {}

  async end(_options?: { sessionId?: string; immediate?: boolean }): Promise<void> {}

  async cleanupStale(_options?: {
    activeSessionId?: string | null
  }): Promise<{ cleaned: number }> {
    return { cleaned: 0 }
  }

  async pendingNativeActions(): Promise<{ actions: LiveActivityNativeAction[] }> {
    return { actions: [] }
  }

  async clearPendingActions(_options?: { ids?: string[] }): Promise<void> {}

  async consumePendingDeepLink(): Promise<{ url: null }> {
    return { url: null }
  }
}
