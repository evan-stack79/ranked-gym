/**
 * Edge Function — analyse photo repas via Gemini 1.5 Flash
 *
 * Secrets (Dashboard → Edge Functions → Secrets) :
 *   GEMINI_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Deploy :
 *   supabase functions deploy analyze-meal-photo
 */
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const SYSTEM_PROMPT =
  'Tu es un nutritionniste. Analyse cette photo. Renvoie un objet JSON avec les clés : calories, proteines, glucides, lipides (valeurs en nombres entiers).'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.round(n))
}

function parseMacros(raw: unknown): {
  calories: number
  proteines: number
  glucides: number
  lipides: number
} {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    calories: toInt(obj.calories),
    proteines: toInt(obj.proteines ?? obj.protein ?? obj.proteinG),
    glucides: toInt(obj.glucides ?? obj.carbs ?? obj.carbsG),
    lipides: toInt(obj.lipides ?? obj.fat ?? obj.fatG),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Méthode non autorisée.' }, 405)
  }

  const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()

  if (!geminiKey || !supabaseUrl || !anonKey || !serviceKey) {
    console.error('[analyze-meal-photo] missing env secrets')
    return jsonResponse({ error: 'Configuration serveur incomplète (secrets Gemini/Supabase).' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentification requise.' }, 401)
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    console.error('[analyze-meal-photo] auth failed:', userError?.message)
    return jsonResponse({ error: 'Session invalide — reconnecte-toi.' }, 401)
  }

  let body: { imageBase64?: string; mimeType?: string }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Corps JSON invalide.' }, 400)
  }

  const imageBase64 = typeof body.imageBase64 === 'string' ? body.imageBase64.replace(/^data:[^;]+;base64,/, '') : ''
  const mimeType =
    typeof body.mimeType === 'string' && body.mimeType.startsWith('image/')
      ? body.mimeType
      : 'image/jpeg'

  if (!imageBase64 || imageBase64.length < 64) {
    return jsonResponse({ error: 'Image manquante ou trop petite.' }, 400)
  }

  // ~4 Mo base64 max après compression client
  if (imageBase64.length > 5_500_000) {
    return jsonResponse({ error: 'Image trop lourde — recompresse côté client.' }, 413)
  }

  const admin = createClient(supabaseUrl, serviceKey)

  const { data: reserveRows, error: reserveError } = await admin.rpc('reserve_ai_meal_scan', {
    p_user_id: user.id,
  })

  if (reserveError) {
    console.error('[analyze-meal-photo] reserve failed:', reserveError.message)
    return jsonResponse({ error: `Quota indisponible : ${reserveError.message}` }, 500)
  }

  const reserve = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows
  const allowed = Boolean(reserve?.allowed)
  const scanCount = Number(reserve?.scan_count ?? 0)
  const dailyLimit = Number(reserve?.daily_limit ?? 5)

  if (!allowed) {
    return jsonResponse(
      {
        error: `Limite atteinte : ${dailyLimit} analyses photo / jour.`,
        code: 'DAILY_LIMIT',
        scanCount,
        dailyLimit,
        scansRemaining: 0,
      },
      429,
    )
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: imageBase64,
        },
      },
      {
        text: 'Analyse le repas visible sur la photo et estime les macros pour une portion typique.',
      },
    ])

    const text = result.response.text()
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[analyze-meal-photo] invalid JSON from model:', text.slice(0, 400))
      await admin.rpc('release_ai_meal_scan', { p_user_id: user.id })
      return jsonResponse({ error: 'Réponse Gemini non JSON — réessaie.' }, 502)
    }

    const macros = parseMacros(parsed)
    if (macros.calories <= 0) {
      console.error('[analyze-meal-photo] zero macros from model:', text.slice(0, 400))
      await admin.rpc('release_ai_meal_scan', { p_user_id: user.id })
      return jsonResponse(
        {
          error: 'Impossible d’estimer le repas — reprends la photo (repas visible, bon éclairage).',
          code: 'EMPTY_MACROS',
          scansRemaining: Math.max(0, dailyLimit - Math.max(0, scanCount - 1)),
        },
        422,
      )
    }

    const scansRemaining = Math.max(0, dailyLimit - scanCount)

    return jsonResponse({
      ...macros,
      scanCount,
      dailyLimit,
      scansRemaining,
    })
  } catch (e) {
    console.error('[analyze-meal-photo] Gemini error:', e)
    await admin.rpc('release_ai_meal_scan', { p_user_id: user.id })
    const message = e instanceof Error ? e.message : 'Erreur Gemini'
    return jsonResponse({ error: message }, 502)
  }
})
