import { cronJobs, makeFunctionReference } from 'convex/server'

/**
 * Jobs planifiés Convex.
 * Churn Surveillance fitness : scan quotidien (seuil documenté dans
 * docs/SURVEILLANCE_FITNESS_WEBHOOK.md).
 * Ranked soft reset : scan quotidien des cycles expirés (ARCHI closeCycle).
 */
const crons = cronJobs()

const scanChurnRef = makeFunctionReference<
  'mutation',
  { now?: number; limit?: number },
  { scanned: number; scheduled: number }
>('surveillanceFitness:scanSurveillanceFitnessChurn')

crons.daily(
  'surveillance fitness churn scan',
  { hourUTC: 6, minuteUTC: 15 },
  scanChurnRef,
  {},
)

const closeRankedCycleRef = makeFunctionReference<
  'mutation',
  { now?: number },
  {
    ok: true
    closedCycleId: string | null
    newCycleId: string
    relocated: number
    verifiedPrWiped?: false
  }
>('ranked:closeCycleCron')

crons.daily(
  'ranked force soft reset scan',
  { hourUTC: 5, minuteUTC: 10 },
  closeRankedCycleRef,
  {},
)

export default crons
