/**
 * Scheduled jobs for « Classement de ma salle ».
 * Nightly ranking recompute + retention purges.
 * Deployed with Convex by the team lead (do not deploy from this PR).
 */
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

/** Ranking never live — recompute once per night (Europe/Paris ~03:15). */
crons.daily(
  'gym-leaderboard-nightly-recompute',
  { hourUTC: 1, minuteUTC: 15 },
  internal.gymLeaderboard.recomputeAllNightly,
)

/** Visit days deleted after 60 days. */
crons.daily(
  'gym-visit-days-retention-60d',
  { hourUTC: 2, minuteUTC: 10 },
  internal.gymLeaderboard.purgeExpiredVisits,
)

/** Google place lat/lng cleared after 30 days. */
crons.daily(
  'gym-google-loc-retention-30d',
  { hourUTC: 2, minuteUTC: 25 },
  internal.gymLeaderboard.purgeExpiredGoogleLocs,
)

export default crons
