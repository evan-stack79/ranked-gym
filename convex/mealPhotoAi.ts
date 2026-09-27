import { v } from 'convex/values'
import { api, internal } from './_generated/api'
import { action, env, type ActionCtx } from './_generated/server'
import {
  clientFacingFromGeminiError,
  clientFacingGeminiFailure,
  DEFAULT_TOTAL_BUDGET_MS,
  runGeminiWithRetryFallback,
  uniqueModelCandidates,
} from './lib/geminiMealPhotoRetry'

const AI_MEAL_DAILY_LIMIT = 5
const CONVEX_MAX_BASE64_CHARS = 900_000
const GEMINI_TIMEOUT_PER_REQUEST_MS = 12_000

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

const GEMINI_MODEL_FALLBACKS = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
] as const

type AnalyzeSuccess = {
  ok: true
  calories: number
  proteines: number
  glucides: number
  lipides: number
  scanCount: number
  dailyLimit: number
  scansRemaining: number
}

type AnalyzeFailure = {
  ok: false
  error: string
  code: string
  scanCount?: number
  dailyLimit?: number
  scansRemaining?: number
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
  const envMap = env as Record<string, string | undefined>
  const fromEnv = typeof envMap.GEMINI_MODEL === 'string' ? envMap.GEMINI_MODEL.trim() : ''
  const ordered = fromEnv
    ? [fromEnv, ...GEMINI_MODEL_FALLBACKS.filter((m) => m !== fromEnv)]
    : [...GEMINI_MODEL_FALLBACKS]
  return uniqueModelCandidates(ordered)
}

function scansRemainingAfterRelease(scanCount: number, dailyLimit: number): number {
  return Math.max(0, dailyLimit - Math.max(0, scanCount - 1))
}

async function releaseReservedScan(ctx: ActionCtx, userId: string) {
  try {
    await ctx.runMutation(internal.rpc.releaseAiMealScanInternal, { userId })
  } catch (error) {
    console.error('[meal-photo-ai] release quota failed', error)
  }
}

function failure(
  error: string,
  code: string,
  usage?: { scanCount: number; dailyLimit: number; scansRemaining: number },
): AnalyzeFailure {
  return usage
    ? {
        ok: false,
        error,
        code,
        scanCount: usage.scanCount,
        dailyLimit: usage.dailyLimit,
        scansRemaining: usage.scansRemaining,
      }
    : { ok: false, error, code }
}

function extractGeminiText(payload: unknown): string | null {
  const data = (payload && typeof payload === 'object' ? payload : {}) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }
  const candidates = Array.isArray(data.candidates) ? data.candidates : []
  for (const candidate of candidates) {
    const parts = Array.isArray(candidate?.content?.parts) ? candidate.content.parts : []
    const merged = parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('\n')
      .trim()
    if (merged) return merged
  }
  return null
}

async function callGeminiOnce(input: {
  modelName: string
  geminiKey: string
  imageBase64: string
  mimeType: string
}): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_PER_REQUEST_MS)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(input.modelName)}:generateContent?key=${encodeURIComponent(input.geminiKey)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType: input.mimeType,
                    data: input.imageBase64,
                  },
                },
                { text: USER_PROMPT },
              ],
            },
          ],
        }),
        signal: controller.signal,
      },
    )

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      const sample = detail.trim().slice(0, 500)
      throw new Error(
        `Gemini request failed for models/${input.modelName}: ${response.status} ${response.statusText}${sample ? ` - ${sample}` : ''}`,
      )
    }

    const payload = (await response.json()) as unknown
    const text = extractGeminiText(payload)
    if (!text) {
      throw new Error(`Gemini response empty for models/${input.modelName}`)
    }
    return text
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Gemini timeout for models/${input.modelName}`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

const successValidator = v.object({
  ok: v.literal(true),
  calories: v.number(),
  proteines: v.number(),
  glucides: v.number(),
  lipides: v.number(),
  scanCount: v.number(),
  dailyLimit: v.number(),
  scansRemaining: v.number(),
})

const failureValidator = v.object({
  ok: v.literal(false),
  error: v.string(),
  code: v.string(),
  scanCount: v.optional(v.number()),
  dailyLimit: v.optional(v.number()),
  scansRemaining: v.optional(v.number()),
})

export const analyzeMealPhoto = action({
  args: {
    sessionToken: v.string(),
    imageBase64: v.string(),
    mimeType: v.optional(v.string()),
  },
  returns: v.union(successValidator, failureValidator),
  handler: async (ctx, args): Promise<AnalyzeSuccess | AnalyzeFailure> => {
    const session = await ctx.runQuery(api.auth.getSession, { sessionToken: args.sessionToken })
    if (!session) {
      return failure('Session expirée — reconnecte-toi puis réessaie.', 'AUTH_REQUIRED')
    }

    const imageBase64 = args.imageBase64.replace(/^data:[^;]+;base64,/, '').trim()
    const mimeType =
      typeof args.mimeType === 'string' && args.mimeType.startsWith('image/')
        ? args.mimeType
        : 'image/jpeg'

    if (!imageBase64 || imageBase64.length < 64) {
      return failure('Image manquante ou trop petite.', 'IMAGE_INVALID')
    }

    if (imageBase64.length > CONVEX_MAX_BASE64_CHARS) {
      return failure('Photo trop volumineuse — recadre puis réessaie.', 'IMAGE_TOO_LARGE')
    }

    const envMap = env as Record<string, string | undefined>
    const geminiKey =
      typeof envMap.GEMINI_API_KEY === 'string' ? envMap.GEMINI_API_KEY.trim() : ''
    if (!geminiKey) {
      const unavailable = clientFacingGeminiFailure('unavailable')
      return failure(unavailable.error, unavailable.code)
    }

    const reserve = await ctx.runMutation(internal.rpc.reserveAiMealScanInternal, {
      userId: session.userId,
    })

    if (!reserve.allowed) {
      return failure(
        `Limite atteinte : ${reserve.daily_limit} analyses photo / jour.`,
        'DAILY_LIMIT',
        {
          scanCount: reserve.scan_count,
          dailyLimit: reserve.daily_limit,
          scansRemaining: 0,
        },
      )
    }

    try {
      const { result: text, modelUsed } = await runGeminiWithRetryFallback({
        models: geminiModelCandidates(),
        budgetMs: DEFAULT_TOTAL_BUDGET_MS,
        attempt: (modelName) =>
          callGeminiOnce({
            modelName,
            geminiKey,
            imageBase64,
            mimeType,
          }),
      })
      console.info('[meal-photo-ai] Gemini model used:', modelUsed)

      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        await releaseReservedScan(ctx, session.userId)
        return failure('Réponse IA non exploitable — réessaie.', 'ai_error', {
          scanCount: reserve.scan_count,
          dailyLimit: reserve.daily_limit,
          scansRemaining: scansRemainingAfterRelease(reserve.scan_count, reserve.daily_limit),
        })
      }

      const macros = parseMacros(parsed)
      if (macros.calories <= 0) {
        await releaseReservedScan(ctx, session.userId)
        return failure(
          'Impossible d’estimer le repas — reprends la photo (repas visible, bon éclairage).',
          'EMPTY_MACROS',
          {
            scanCount: reserve.scan_count,
            dailyLimit: reserve.daily_limit,
            scansRemaining: scansRemainingAfterRelease(reserve.scan_count, reserve.daily_limit),
          },
        )
      }

      const scansRemaining = Math.max(0, reserve.daily_limit - reserve.scan_count)

      return {
        ok: true,
        ...macros,
        scanCount: reserve.scan_count,
        dailyLimit: reserve.daily_limit,
        scansRemaining,
      }
    } catch (error) {
      await releaseReservedScan(ctx, session.userId)
      const facing = clientFacingFromGeminiError(error)
      return failure(facing.error, facing.code, {
        scanCount: reserve.scan_count,
        dailyLimit: reserve.daily_limit,
        scansRemaining: scansRemainingAfterRelease(reserve.scan_count, reserve.daily_limit),
      })
    }
  },
})
