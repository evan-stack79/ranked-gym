/**
 * Edge Function — moteur nutritionnel déterministe (EER IOM + BCMR + Waterfall).
 *
 * Deploy : supabase functions deploy nutrition-engine
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  runNutritionEngineApi,
  validateForbiddenActivityFields,
  type EffortIntensity,
  type NutritionEngineInput,
} from '../../../src/nutrition-engine/index.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function parseIntensity(raw: unknown): EffortIntensity | null {
  if (raw === 'low' || raw === 'moderate' || raw === 'high') return raw
  if (raw === 'ELEVEE' || raw === 'elevee') return 'high'
  if (raw === 'MODEREE' || raw === 'moderee') return 'moderate'
  if (raw === 'FAIBLE' || raw === 'faible') return 'low'
  return null
}

function parseBody(raw: unknown): NutritionEngineInput | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>

  const forbidden = validateForbiddenActivityFields(b)
  if (forbidden) {
    throw forbidden
  }

  const weightLoss =
    b.effort_weight_loss_kg != null
      ? Number(b.effort_weight_loss_kg)
      : b.poids_perdu_effort_kg != null
        ? Number(b.poids_perdu_effort_kg)
        : 0

  return {
    sex: b.sex === 'female' || b.sexe === 'F' ? 'female' : 'male',
    age: Number(b.age ?? b.age),
    weight_kg: Number(b.weight_kg ?? b.poids_kg),
    height_m: Number(b.height_m ?? b.taille_m),
    activity: Number(b.activity ?? b.niveau_activite) as NutritionEngineInput['activity'],
    goal: (b.goal === 'cut' || b.objectif === 'PERTE_POIDS'
      ? 'cut'
      : b.goal === 'bulk' || b.objectif === 'PRISE_MASSE'
        ? 'bulk'
        : 'maintain') as NutritionEngineInput['goal'],
    deficit_kcal: Number(b.deficit_kcal ?? 0),
    surplus_kcal: Number(b.surplus_kcal ?? 0),
    sport_principal: typeof b.sport_principal === 'string' ? b.sport_principal : null,
    sport_secondaire: typeof b.sport_secondaire === 'string' ? b.sport_secondaire : null,
    duration_h: Number(b.duration_h ?? b.duree_seance_h ?? 0),
    intensity: parseIntensity(b.intensity ?? b.intensite),
    effort_weight_loss_kg: weightLoss,
    effort_fluid_loss_l: Number(b.effort_fluid_loss_l ?? 0),
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
        target_kcal: 0,
        bcmr_kcal: 0,
        recommandations_ui: [],
      }),
      {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }

  try {
    const raw = await req.json()
    const forbidden = validateForbiddenActivityFields(
      raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {},
    )
    if (forbidden) {
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_code: forbidden.code,
          target_kcal: 0,
          bcmr_kcal: 0,
          recommandations_ui: [],
        }),
        { status: forbidden.httpStatus, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const body = parseBody(raw)
    if (!body) {
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_code: 'ERR_INVALID_BODY',
          target_kcal: 0,
          bcmr_kcal: 0,
          recommandations_ui: [],
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { status, body: payload } = runNutritionEngineApi(body)
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err) {
      const failure = err as { code: string; httpStatus: number }
      return new Response(
        JSON.stringify({
          status: 'ERROR',
          error_code: failure.code,
          target_kcal: 0,
          bcmr_kcal: 0,
          recommandations_ui: [],
        }),
        { status: failure.httpStatus ?? 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }
    return new Response(
      JSON.stringify({
        status: 'ERROR',
        error_code: 'ERR_INTERNAL',
        target_kcal: 0,
        bcmr_kcal: 0,
        recommandations_ui: [],
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
