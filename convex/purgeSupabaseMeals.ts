/**
 * Purge Supabase nutrition.journal + user_backups.payload côté serveur.
 * Identité Supabase = lien stocké (auth_account_links.supabaseUserId),
 * jamais l’id Convex ni un id envoyé par le téléphone.
 * Service-role côté serveur — pas de session Supabase téléphone requise.
 */
import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action } from './_generated/server'
import {
  StripJournalParseError,
  parseJournalObject,
  stripMealsFromBackupPayload,
  stripMealsFromJournalJson,
} from './lib/stripJournalMeals'

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

function readSupabaseAdminConfig(): { url: string; serviceKey: string } | null {
  const url = (readEnv('MIGRATION_SUPABASE_URL') || readEnv('SUPABASE_URL') || '').trim()
  // Server-only secrets — never VITE_*, never returned to the client.
  const serviceKey = (
    readEnv('MIGRATION_SUPABASE_SERVICE_ROLE_KEY') ||
    readEnv('SUPABASE_SERVICE_ROLE_KEY') ||
    ''
  ).trim()
  if (!url || !serviceKey) return null
  return { url: url.replace(/\/$/, ''), serviceKey }
}

/** Errors exposed to the client must stay opaque — never echo the admin key. */
export function toClientSafePurgeError(error: unknown, secrets: string[] = []): Error {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  for (const secret of secrets) {
    if (secret && raw.includes(secret)) {
      return new Error('ERASE_MEALS_PURGE_FAILED')
    }
  }
  if (
    raw === 'ERASE_MEALS_PURGE_FAILED' ||
    raw === 'ACCOUNT_LINK_MISSING' ||
    raw === 'ACCOUNT_LINK_UNAUTHORIZED'
  ) {
    return new Error(raw)
  }
  return new Error('ERASE_MEALS_PURGE_FAILED')
}

type RestSelectResult = {
  data: unknown
  error: { message: string } | null
  count: number | null
}

function countMealsInJournal(journal: unknown): number {
  const obj = parseJournalObject(journal)
  let n = 0
  for (const day of Object.values(obj)) {
    if (!day || typeof day !== 'object' || Array.isArray(day)) continue
    const meals = (day as { meals?: unknown }).meals
    if (Array.isArray(meals)) n += meals.length
  }
  return n
}

function countMealsInBackupPayload(payload: unknown): number {
  let rootRaw: unknown = payload
  if (typeof payload === 'string') {
    rootRaw = JSON.parse(payload)
  }
  if (!rootRaw || typeof rootRaw !== 'object' || Array.isArray(rootRaw)) {
    throw new StripJournalParseError()
  }
  const root = rootRaw as Record<string, unknown>
  let n = 0
  const nutrition = root.nutrition
  if (nutrition && typeof nutrition === 'object' && !Array.isArray(nutrition)) {
    const nut = nutrition as Record<string, unknown>
    if ('journal' in nut) n += countMealsInJournal(nut.journal)
    if ('journalJson' in nut) n += countMealsInJournal(nut.journalJson)
  }
  if ('journal' in root) n += countMealsInJournal(root.journal)
  return n
}

async function restSelectSingle(
  config: { url: string; serviceKey: string },
  table: 'nutrition' | 'user_backups',
  userId: string,
  columns: string,
): Promise<RestSelectResult> {
  const endpoint = `${config.url}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}&select=${encodeURIComponent(columns)}`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        Prefer: 'count=exact',
        Accept: 'application/json',
      },
    })
  } catch (error) {
    return {
      data: null,
      error: { message: error instanceof Error ? error.message : 'FETCH_FAILED' },
      count: null,
    }
  }

  const contentRange = response.headers.get('content-range')
  let count: number | null = null
  if (contentRange) {
    const total = contentRange.split('/').pop()
    if (total && total !== '*' && /^\d+$/.test(total)) count = Number(total)
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    return { data: null, error: { message: text || `HTTP_${response.status}` }, count }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { data: null, error: { message: 'MALFORMED_JSON' }, count }
  }

  if (!Array.isArray(body)) {
    return { data: null, error: { message: 'MALFORMED_BODY' }, count }
  }

  if (count === null) {
    return { data: null, error: { message: 'COUNT_UNCONFIRMED' }, count: null }
  }

  if (count === 0) {
    return { data: null, error: null, count: 0 }
  }

  if (body.length < 1 || !body[0] || typeof body[0] !== 'object') {
    return { data: null, error: { message: 'ROW_MALFORMED' }, count }
  }

  return { data: body[0], error: null, count }
}

async function restUpdate(
  config: { url: string; serviceKey: string },
  table: 'nutrition' | 'user_backups',
  userId: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; count: number | null }> {
  const endpoint = `${config.url}/rest/v1/${table}?user_id=eq.${encodeURIComponent(userId)}`
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation,count=exact',
        Accept: 'application/json',
      },
      body: JSON.stringify(patch),
    })
  } catch {
    return { ok: false, count: null }
  }

  const contentRange = response.headers.get('content-range')
  let count: number | null = null
  if (contentRange) {
    const total = contentRange.split('/').pop()
    if (total && total !== '*' && /^\d+$/.test(total)) count = Number(total)
  }

  if (!response.ok) return { ok: false, count }
  if (typeof count !== 'number' || count < 1) return { ok: false, count }
  return { ok: true, count }
}

/**
 * Compte les repas restants dans Supabase (journal) via le lien + service-role.
 * Toujours interrogé même si Convex a 0 repas (B8-03).
 */
export const countSupabaseMealCopies = action({
  args: {
    sessionToken: v.string(),
  },
  returns: v.object({
    count: v.number(),
    resolvedUserId: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ count: number; resolvedUserId: string }> => {
    const session: { userId: string } | null = await ctx.runQuery(api.auth.getSession, {
      sessionToken: args.sessionToken,
    })
    if (!session?.userId) throw new Error('ERASE_MEALS_PURGE_FAILED')

    const link: {
      ownerUserId: string
      supabaseUserId: string
      linkedAt: number
    } | null = await ctx.runQuery(internal.accountLinks.getLinkByOwner, {
      ownerUserId: session.userId,
    })
    if (!link?.supabaseUserId) throw new Error('ACCOUNT_LINK_MISSING')

    const config = readSupabaseAdminConfig()
    if (!config) throw new Error('ERASE_MEALS_PURGE_FAILED')

    const nutritionSelect = await restSelectSingle(
      config,
      'nutrition',
      link.supabaseUserId,
      'journal,user_id',
    )
    if (nutritionSelect.error || typeof nutritionSelect.count !== 'number') {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }
    if (nutritionSelect.count === 0) {
      return { count: 0, resolvedUserId: link.supabaseUserId }
    }
    const row = nutritionSelect.data as Record<string, unknown>
    if (row.user_id != null && row.user_id !== link.supabaseUserId) {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }
    try {
      const count = countMealsInJournal(row.journal)
      if (typeof count !== 'number' || !Number.isFinite(count) || count < 0) {
        throw new Error('ERASE_MEALS_PURGE_FAILED')
      }
      return { count, resolvedUserId: link.supabaseUserId }
    } catch {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }
  },
})

/** SessionToken only — userId never accepted from the phone. */
export const purgeSupabaseMealCopies = action({
  args: {
    sessionToken: v.string(),
  },
  returns: v.object({
    deletedCount: v.number(),
    nutritionStatus: v.union(v.literal('purged'), v.literal('absent')),
    userBackupsStatus: v.union(v.literal('purged'), v.literal('absent')),
    resolvedUserId: v.string(),
  }),
  handler: async (ctx, args): Promise<{
    deletedCount: number
    nutritionStatus: 'purged' | 'absent'
    userBackupsStatus: 'purged' | 'absent'
    resolvedUserId: string
  }> => {
    const session: { userId: string } | null = await ctx.runQuery(api.auth.getSession, {
      sessionToken: args.sessionToken,
    })
    if (!session?.userId) {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }

    const link: {
      ownerUserId: string
      supabaseUserId: string
      linkedAt: number
    } | null = await ctx.runQuery(internal.accountLinks.getLinkByOwner, {
      ownerUserId: session.userId,
    })
    if (!link?.supabaseUserId) {
      throw new Error('ACCOUNT_LINK_MISSING')
    }
    // B7-03 : toujours l’id Supabase du lien, jamais l’id Convex de session.
    const supabaseUserId: string = link.supabaseUserId

    const config = readSupabaseAdminConfig()
    if (!config) {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }

    const now = new Date().toISOString()
    let deletedCount = 0

    const nutritionSelect = await restSelectSingle(
      config,
      'nutrition',
      supabaseUserId,
      'journal,profile,updated_at,user_id',
    )
    if (nutritionSelect.error || typeof nutritionSelect.count !== 'number') {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }

    let nutritionStatus: 'purged' | 'absent'
    if (nutritionSelect.count === 0) {
      if (nutritionSelect.data != null) throw new Error('ERASE_MEALS_PURGE_FAILED')
      nutritionStatus = 'absent'
    } else {
      const row = nutritionSelect.data as Record<string, unknown>
      if (row.user_id != null && row.user_id !== supabaseUserId) {
        throw new Error('ERASE_MEALS_PURGE_FAILED')
      }
      try {
        deletedCount += countMealsInJournal(row.journal)
        const nextJournal = stripMealsFromJournalJson(row.journal)
        const updated = await restUpdate(config, 'nutrition', supabaseUserId, {
          journal: nextJournal,
          updated_at: now,
        })
        if (!updated.ok) throw new Error('ERASE_MEALS_PURGE_FAILED')
      } catch {
        throw new Error('ERASE_MEALS_PURGE_FAILED')
      }
      nutritionStatus = 'purged'
    }

    const backupSelect = await restSelectSingle(
      config,
      'user_backups',
      supabaseUserId,
      'payload,updated_at,user_id',
    )
    if (backupSelect.error || typeof backupSelect.count !== 'number') {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }

    let userBackupsStatus: 'purged' | 'absent'
    if (backupSelect.count === 0) {
      if (backupSelect.data != null) throw new Error('ERASE_MEALS_PURGE_FAILED')
      userBackupsStatus = 'absent'
    } else {
      const row = backupSelect.data as Record<string, unknown>
      if (row.user_id != null && row.user_id !== supabaseUserId) {
        throw new Error('ERASE_MEALS_PURGE_FAILED')
      }
      try {
        deletedCount += countMealsInBackupPayload(row.payload)
        const nextPayload = stripMealsFromBackupPayload(row.payload)
        const updated = await restUpdate(config, 'user_backups', supabaseUserId, {
          payload: nextPayload,
          updated_at: now,
        })
        if (!updated.ok) throw new Error('ERASE_MEALS_PURGE_FAILED')
      } catch {
        throw new Error('ERASE_MEALS_PURGE_FAILED')
      }
      userBackupsStatus = 'purged'
    }

    if (typeof deletedCount !== 'number' || !Number.isFinite(deletedCount)) {
      throw new Error('ERASE_MEALS_PURGE_FAILED')
    }

    return {
      deletedCount,
      nutritionStatus,
      userBackupsStatus,
      resolvedUserId: supabaseUserId,
    }
  },
})
