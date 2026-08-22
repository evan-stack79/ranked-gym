/**
 * Edge Function — analyse photo repas via Gemini Flash (vision + JSON)
 *
 * Secrets (Dashboard → Edge Functions → Secrets) :
 *   GEMINI_API_KEY
 *   GEMINI_MODEL (optionnel, ex. gemini-2.5-flash)
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Deploy :
 *   supabase functions deploy analyze-meal-photo
 */
import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai'

const SYSTEM_PROMPT = `Tu es un nutritionniste expert en analyse visuelle de repas. Ta priorité absolue est la PRÉCISION et la SOUS-ESTIMATION prudente des calories — jamais l'inverse.

Règles strictes :

1) Volume / poids (conservateur)
- Estime le poids total de chaque aliment visible en grammes, puis calcule les macros à partir de ce poids.
- Sois extrêmement conservateur sur les portions : en cas de doute sur la taille, choisis la fourchette BASSE.
- Si un aliment semble nature (vapeur, bouilli, cru, grillé sec) SANS sauce visible, SANS brillance/gras apparent, SANS bain d'huile → utilise UNIQUEMENT les valeurs des aliments nature (tables CIQUAL / USDA).
- Exemples de références nature (kcal/100g) :
  • Pomme de terre vapeur / bouillie : ~85 kcal, 2g P, 17g G, 0g L
  • Riz blanc cuit : ~130 kcal
  • Pâtes cuites nature : ~130 kcal
  • Poulet blanc cuit sans peau : ~165 kcal
  • Brocoli cuit vapeur : ~35 kcal
- N'utilise JAMAIS les valeurs « poêlées », « sautées », « frites » ou « avec beurre » sauf si tu vois CLAIREMENT l'huile, le beurre, une sauce grasse ou une coloration de friture.

2) Fourchette basse par défaut (matière grasse cachée)
- En cas de doute sur beurre, huile ou sauce cachée → considère l'aliment comme NATURE (0–5 g lipides max pour la portion entière sauf preuve visuelle contraire).
- Ne gonfle pas les calories « par sécurité » : une surestimation de 30–50 % est interdite.
- Les lipides ne doivent augmenter que si tu vois : brillance grasse, sauce crémeuse, panure frite, bord caramélisé/gras, huile en surface.

3) Précision des macros (cohérence scientifique)
- calories ≈ (proteines × 4) + (glucides × 4) + (lipides × 9), à ±10 % près.
- Utilise des densités réalistes CIQUAL/USDA par 100 g, multipliées par le poids estimé.
- Arrondis à l'entier. proteines, glucides, lipides en grammes.

Méthode obligatoire (interne, ne pas inclure dans le JSON) :
a) Lister mentalement chaque aliment + poids estimé (g)
b) Appliquer kcal/100g NATURE sauf preuve de cuisson grasse
c) Sommer, vérifier cohérence kcal ↔ macros
d) Si total incertain, réduire le poids estimé de 10–15 % plutôt que d'ajouter du gras

Format de réponse : UNIQUEMENT un objet JSON valide, sans markdown, avec exactement ces clés entières :
{ "calories": number, "proteines": number, "glucides": number, "lipides": number }`

const USER_PROMPT =
  'Analyse la photo : estime le poids (g) de chaque aliment visible, applique les valeurs CIQUAL/USDA nature par défaut, privilégie la fourchette basse. Renvoie le JSON final (calories, proteines, glucides, lipides).'

/** Modèles vision testés par ordre si le précédent renvoie 404. */
const GEMINI_MODEL_FALLBACKS = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
] as const

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

function geminiModelCandidates(): string[] {
  const fromEnv = Deno.env.get('GEMINI_MODEL')?.trim()
  const ordered = fromEnv
    ? [fromEnv, ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== fromEnv)]
    : [...GEMINI_MODEL_FALLBACKS]
  return [...new Set(ordered)]
}

function isGeminiModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /404|not found|NOT_FOUND/i.test(message) && /models\//i.test(message)
}

function isGeminiApiKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /API_KEY_INVALID|API key not valid|invalid api key|PERMISSION_DENIED/i.test(message)
}

function friendlyGeminiError(error: unknown): string {
  if (isGeminiApiKeyError(error)) {
    return 'Clé Gemini invalide — crée une clé sur aistudio.google.com/apikey et mets-la dans Supabase → Secrets → GEMINI_API_KEY (format AIzaSy…).'
  }
  if (isGeminiModelNotFoundError(error)) {
    return 'Modèle Gemini indisponible — ajoute GEMINI_MODEL=gemini-3.6-flash dans les secrets Supabase.'
  }
  return error instanceof Error ? error.message : 'Erreur Gemini'
}

function buildGeminiModel(genAI: GoogleGenerativeAI, modelName: string): GenerativeModel {
  return genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  })
}

async function analyzeImageWithGemini(
  genAI: GoogleGenerativeAI,
  imageBase64: string,
  mimeType: string,
): Promise<{ text: string; modelUsed: string }> {
  const candidates = geminiModelCandidates()
  let lastError: unknown = null

  for (const modelName of candidates) {
    try {
      const model = buildGeminiModel(genAI, modelName)
      const result = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: imageBase64,
          },
        },
        {
          text: USER_PROMPT,
        },
      ])
      return { text: result.response.text(), modelUsed: modelName }
    } catch (error) {
      lastError = error
      if (isGeminiModelNotFoundError(error)) {
        console.warn('[analyze-meal-photo] model unavailable, trying next:', modelName, error)
        continue
      }
      throw error
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(
        `Aucun modèle Gemini disponible (${candidates.join(', ')}). Définis GEMINI_MODEL dans les secrets Supabase.`,
      )
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
    const { text, modelUsed } = await analyzeImageWithGemini(genAI, imageBase64, mimeType)
    console.log('[analyze-meal-photo] Gemini model used:', modelUsed)

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
    return jsonResponse({ error: friendlyGeminiError(e) }, 502)
  }
})
