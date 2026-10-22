/**
 * Compat repos → pont LiveActivity unifié (kind: rest).
 * Conservé pour RestTimerContext et les mocks de tests existants.
 */
export {
  isNativeIosShell,
  isLiveActivityAvailable as isRestLiveActivityAvailable,
  startRestLiveActivity,
  updateRestLiveActivity,
  endRestLiveActivity,
} from './liveActivity'

export type { LiveActivityPayload as RestLiveActivityPayload } from './liveActivity'
