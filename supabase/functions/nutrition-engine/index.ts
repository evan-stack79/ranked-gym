/**
 * Edge Function — moteur nutritionnel déterministe (EER IOM + BCMR + Waterfall).
 *
 * Deploy : supabase functions deploy nutrition-engine
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  runNutritionEngineApi,
  type NutritionEngineInput,
} from '../../../src/nutrition-engine/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseBody(raw: unknown): NutritionEngineInput | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  return {
    sex: b.sex === 'female' ? 'female' : 'male',
    age: Number(b.age),
    weight_kg: Number(b.weight_kg),
    height_m: Number(b.height_m),
    activity: Number(b.activity) as NutritionEngineInput['activity'],
    goal: (b.goal === 'cut' || b.goal === 'bulk' ? b.goal : 'maintain') as NutritionEngineInput['goal'],
    deficit_kcal: Number(b.deficit_kcal ?? 0),
    surplus_kcal: Number(b.surplus_kcal ?? 0),
    sport_principal: typeof b.sport_principal === 'string' ? b.sport_principal : null,
    sport_secondaire: typeof b.sport_secondaire === 'string' ? b.sport_secondaire : null,
    duration_h: Number(b.duration_h ?? 0),
    effort_fluid_loss_l: Number(b.effort_fluid_loss_l ?? 0),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: { code: 'ERR_METHOD', message: 'POST only' } }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = parseBody(await req.json())
    if (!body) {
      return new Response(
        JSON.stringify({ ok: false, error: { code: 'ERR_INVALID_BODY', message: 'JSON body required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { status, body: payload } = runNutritionEngineApi(body)
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: { code: 'ERR_INTERNAL', message: 'Invalid JSON' } }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
