import { query } from './_generated/server'
import { v } from 'convex/values'

/** Connectivity probe. No auth, no user data. Safe to call before cutover. */
export const ping = query({
  args: {},
  returns: v.object({
    ok: v.literal(true),
    schemaVersion: v.number(),
  }),
  handler: async () => {
    return { ok: true as const, schemaVersion: 1 }
  },
})
