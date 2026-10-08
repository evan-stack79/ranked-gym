/**
 * Google Places (New) for gym search — server-only.
 * Key: GOOGLE_PLACES_API_KEY (Convex env, never VITE_, never logged).
 * Disabled when the env var is missing → app offers manual add only.
 */
import { v } from 'convex/values'
import { action, internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { requireSessionUser } from './lib/auth'
import {
  formatDateKeyUtc,
  GOOGLE_PLACES_API_KEY_ENV,
  GOOGLE_SEARCH_DAILY_LIMIT,
} from './gymLeaderboardLogic'

export { GOOGLE_PLACES_API_KEY_ENV, GOOGLE_SEARCH_DAILY_LIMIT }

function readEnv(name: string): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
  return proc?.env?.[name]
}

export function getGooglePlacesApiKey(
  envReader: (name: string) => string | undefined = readEnv,
): string | null {
  const key = envReader(GOOGLE_PLACES_API_KEY_ENV)?.trim() ?? ''
  return key.length > 0 ? key : null
}

export function isGooglePlacesSearchEnabled(
  envReader: (name: string) => string | undefined = readEnv,
): boolean {
  return getGooglePlacesApiKey(envReader) != null
}

export type PlacesAutocompleteResult =
  | {
      ok: true
      enabled: true
      suggestions: Array<{ placeId: string; primaryText: string; secondaryText: string }>
    }
  | { ok: true; enabled: false; suggestions: [] }
  | { ok: false; error: 'RATE_LIMIT' | 'UPSTREAM' | 'DISABLED'; enabled: boolean; limit?: number }

export type PlaceDetailsResult =
  | {
      ok: true
      enabled: true
      placeId: string
      gymKey: string
      lat: number
      lng: number
      /** Live display only — never persisted by ensureGoogleGym. */
      displayName: string | null
      formattedAddress: string | null
    }
  | { ok: true; enabled: false }
  | { ok: false; error: 'RATE_LIMIT' | 'UPSTREAM' | 'DISABLED' | 'NOT_FOUND'; enabled: boolean }

type FetchLike = typeof fetch

/**
 * Autocomplete (New) — gym filter, session token, cheapest fields.
 * Inject `fetchImpl` in tests (mock).
 */
export async function googlePlacesAutocomplete(args: {
  apiKey: string
  input: string
  sessionToken: string
  fetchImpl?: FetchLike
}): Promise<{
  ok: true
  suggestions: Array<{ placeId: string; primaryText: string; secondaryText: string }>
} | { ok: false; error: 'UPSTREAM' }> {
  const fetchImpl = args.fetchImpl ?? fetch
  const input = args.input.trim()
  if (input.length < 3) {
    return { ok: true, suggestions: [] }
  }
  try {
    const res = await fetchImpl('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': args.apiKey,
        // Essentials Autocomplete — no Pro fields
        'X-Goog-FieldMask':
          'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input,
        sessionToken: args.sessionToken,
        includedPrimaryTypes: ['gym'],
        languageCode: 'fr',
      }),
    })
    if (!res.ok) return { ok: false, error: 'UPSTREAM' }
    const json = (await res.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string
          structuredFormat?: {
            mainText?: { text?: string }
            secondaryText?: { text?: string }
          }
        }
      }>
    }
    const suggestions = (json.suggestions ?? [])
      .map((s) => {
        const p = s.placePrediction
        if (!p?.placeId) return null
        return {
          placeId: p.placeId,
          primaryText: p.structuredFormat?.mainText?.text ?? 'Salle',
          secondaryText: p.structuredFormat?.secondaryText?.text ?? '',
        }
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
    return { ok: true, suggestions }
  } catch {
    return { ok: false, error: 'UPSTREAM' }
  }
}

/**
 * Place Details — location + formattedAddress (Essentials) + displayName (Pro, only on select).
 * Name/address returned to client for live display; only placeId + lat/lng stored.
 */
export async function googlePlaceDetails(args: {
  apiKey: string
  placeId: string
  sessionToken: string
  fetchImpl?: FetchLike
}): Promise<
  | {
      ok: true
      placeId: string
      lat: number
      lng: number
      displayName: string | null
      formattedAddress: string | null
    }
  | { ok: false; error: 'UPSTREAM' | 'NOT_FOUND' }
> {
  const fetchImpl = args.fetchImpl ?? fetch
  const placeId = encodeURIComponent(args.placeId.trim())
  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${placeId}`)
    url.searchParams.set('sessionToken', args.sessionToken)
    url.searchParams.set('languageCode', 'fr')
    const res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': args.apiKey,
        // location + formattedAddress = Essentials; displayName = Pro (only on final pick)
        'X-Goog-FieldMask': 'id,location,formattedAddress,displayName',
      },
    })
    if (res.status === 404) return { ok: false, error: 'NOT_FOUND' }
    if (!res.ok) return { ok: false, error: 'UPSTREAM' }
    const json = (await res.json()) as {
      id?: string
      location?: { latitude?: number; longitude?: number }
      formattedAddress?: string
      displayName?: { text?: string }
    }
    const lat = json.location?.latitude
    const lng = json.location?.longitude
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return { ok: false, error: 'NOT_FOUND' }
    }
    return {
      ok: true,
      placeId: args.placeId.trim(),
      lat,
      lng,
      displayName: json.displayName?.text ?? null,
      formattedAddress: json.formattedAddress ?? null,
    }
  } catch {
    return { ok: false, error: 'UPSTREAM' }
  }
}

/** Testable orchestration (quota + enable gate). */
export async function runPlacesAutocompleteForUser(args: {
  userId: string
  input: string
  sessionTokenPlaces: string
  dateKey: string
  consumeQuota: () => Promise<{ ok: true; count: number } | { ok: false; count: number; limit: number }>
  envReader?: (name: string) => string | undefined
  fetchImpl?: FetchLike
}): Promise<PlacesAutocompleteResult> {
  const key = getGooglePlacesApiKey(args.envReader)
  if (!key) {
    return { ok: true, enabled: false, suggestions: [] }
  }
  const quota = await args.consumeQuota()
  if (!quota.ok) {
    return { ok: false, error: 'RATE_LIMIT', enabled: true, limit: quota.limit }
  }
  const result = await googlePlacesAutocomplete({
    apiKey: key,
    input: args.input,
    sessionToken: args.sessionTokenPlaces,
    fetchImpl: args.fetchImpl,
  })
  if (!result.ok) return { ok: false, error: 'UPSTREAM', enabled: true }
  return { ok: true, enabled: true, suggestions: result.suggestions }
}

export const isSearchEnabled = action({
  args: {},
  handler: async (): Promise<{ enabled: boolean }> => {
    return { enabled: isGooglePlacesSearchEnabled() }
  },
})

export const autocompleteGyms = action({
  args: {
    sessionToken: v.string(),
    input: v.string(),
    placesSessionToken: v.string(),
  },
  handler: async (ctx, args): Promise<PlacesAutocompleteResult> => {
    const auth = await ctx.runMutation(internal.gymPlacesGoogle.resolveSessionUserId, {
      sessionToken: args.sessionToken,
    })
    if (!auth.ok) return { ok: false, error: 'DISABLED', enabled: false }

    const dateKey = formatDateKeyUtc(new Date())
    return runPlacesAutocompleteForUser({
      userId: auth.userId,
      input: args.input,
      sessionTokenPlaces: args.placesSessionToken,
      dateKey,
      consumeQuota: () =>
        ctx.runMutation(internal.gymLeaderboard.consumeSearchQuota, {
          userId: auth.userId,
          dateKey,
        }),
    })
  },
})

export const selectGymPlace = action({
  args: {
    sessionToken: v.string(),
    placeId: v.string(),
    placesSessionToken: v.string(),
  },
  handler: async (ctx, args): Promise<PlaceDetailsResult> => {
    const key = getGooglePlacesApiKey()
    if (!key) return { ok: true, enabled: false }

    const auth = await ctx.runMutation(internal.gymPlacesGoogle.resolveSessionUserId, {
      sessionToken: args.sessionToken,
    })
    if (!auth.ok) return { ok: false, error: 'DISABLED', enabled: false }

    const dateKey = formatDateKeyUtc(new Date())
    const quota = await ctx.runMutation(internal.gymLeaderboard.consumeSearchQuota, {
      userId: auth.userId,
      dateKey,
    })
    if (!quota.ok) {
      return { ok: false, error: 'RATE_LIMIT', enabled: true }
    }

    const details = await googlePlaceDetails({
      apiKey: key,
      placeId: args.placeId,
      sessionToken: args.placesSessionToken,
    })
    if (!details.ok) {
      return { ok: false, error: details.error, enabled: true }
    }

    const ensured = await ctx.runMutation(internal.gymLeaderboard.ensureGoogleGym, {
      placeId: details.placeId,
      lat: details.lat,
      lng: details.lng,
    })

    return {
      ok: true,
      enabled: true,
      placeId: details.placeId,
      gymKey: ensured.gymKey,
      lat: details.lat,
      lng: details.lng,
      displayName: details.displayName,
      formattedAddress: details.formattedAddress,
    }
  },
})

export const resolveSessionUserId = internalMutation({
  args: { sessionToken: v.string() },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; userId: string } | { ok: false }> => {
    try {
      const user = await requireSessionUser(ctx, args.sessionToken)
      return { ok: true, userId: user.userId }
    } catch {
      return { ok: false }
    }
  },
})
