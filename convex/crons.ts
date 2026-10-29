import { cronJobs, makeFunctionReference } from 'convex/server'

/**
 * Jobs planifiés Convex.
 * Churn Surveillance fitness : scan quotidien (seuil documenté dans
 * docs/SURVEILLANCE_FITNESS_WEBHOOK.md).
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

export default crons
