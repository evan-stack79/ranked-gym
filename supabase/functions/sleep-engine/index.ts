/**
 * Edge Function — Sleep Engine V1 (isolé du nutrition-engine).
 *
 * Deploy : supabase functions deploy sleep-engine
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  runSleepEngineApi,
  validateForbiddenFields,
  type SleepInput,
} from '../../../src/sleep-engine/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function asStringArray(value: unknown): string[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) return undefined
  return value.map(String)
}

function asNumberArray(value: unknown): number[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) return undefined
  return value.map(Number)
}

/**
 * Parse le body. Les champs REM/Deep/Light / stages wearables sont
 * volontairement ignorés — ils n’influencent pas le moteur V1.
 */
function parseBody(raw: unknown): SleepInput | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>

  if (typeof b.bedtime !== 'string' || typeof b.waketime !== 'string') return null
  if (b.tstHours == null && b.tst_hours == null) return null

  return {
    bedtime: b.bedtime,
    waketime: b.waketime,
    tstHours: Number(b.tstHours ?? b.tst_hours),
    historicalBedtimes: asStringArray(b.historicalBedtimes ?? b.historical_bedtimes),
    historicalWaketimes: asStringArray(b.historicalWaketimes ?? b.historical_waketimes),
    workdayTstHours: asNumberArray(b.workdayTstHours ?? b.workday_tst_hours),
    currentTibHours:
      b.currentTibHours != null || b.current_tib_hours != null
        ? Number(b.currentTibHours ?? b.current_tib_hours)
        : undefined,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_code: 'ERR_METHOD',
        message: 'POST only',
        recommendations: [],
        warnings: [],
      }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }

  try {
    const raw = await req.json()
    const forbidden = validateForbiddenFields(
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {},
    )
    if (forbidden) {
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_code: forbidden.code,
          message: forbidden.message,
          recommendations: [],
          warnings: [],
        }),
        {
          status: forbidden.httpStatus,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const body = parseBody(raw)
    if (!body) {
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_code: 'ERR_INVALID_BODY',
          message: 'JSON body with bedtime, waketime, tstHours required',
          recommendations: [],
          warnings: [],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { status, body: payload } = runSleepEngineApi(body)
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_code: 'ERR_INTERNAL',
        message: 'Invalid JSON or unexpected error',
        recommendations: [],
        warnings: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
